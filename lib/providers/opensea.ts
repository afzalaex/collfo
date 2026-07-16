import { getAddress, isAddress } from "viem";
import { chainByKey, type SupportedChain } from "../chains";
import { resolveOpenSeaApiKey } from "./opensea-key";

const BASE = "https://api.opensea.io/api/v2";

export { resolveOpenSeaApiKey };

/**
 * OpenSea “created” discovery — same source as
 * https://opensea.io/{address}/created
 *
 * Primary: GraphQL userCreatedCollections(addresses: …)
 * Fallback: scrape urql rehydrate from the created page (exact UI list)
 * Secondary: creator_username + inventory owner-match
 */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * OpenSea fetch with 429 backoff (Retry-After or exponential).
 */
async function osFetch<T>(
  path: string,
  search?: Record<string, string | undefined>,
  options?: { maxRetries?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 6;
  const key = await resolveOpenSeaApiKey();

  const url = new URL(`${BASE}${path}`);
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  let lastErr = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": key,
        accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 429) {
      const body = await res.text().catch(() => "");
      lastErr = body.slice(0, 200);
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(60_000, 1500 * 2 ** attempt);
      if (attempt < maxRetries) {
        await sleep(waitMs);
        continue;
      }
      throw new Error(`OpenSea ${path} 429 (rate limit after retries): ${lastErr}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenSea ${path} ${res.status}: ${body.slice(0, 240)}`);
    }

    return res.json() as Promise<T>;
  }

  throw new Error(`OpenSea ${path} failed: ${lastErr}`);
}

export type OpenSeaAccount = {
  address: string | null;
  username: string | null;
  ens_name: string | null;
  display_name?: string | null;
};

export async function resolveOpenSeaAccount(
  addressOrUsername: string
): Promise<OpenSeaAccount> {
  const path = `/accounts/${encodeURIComponent(addressOrUsername)}`;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) return res.json();
  } catch {
    /* try authenticated */
  }

  try {
    return await osFetch(path);
  } catch {
    return { address: null, username: null, ens_name: null, display_name: null };
  }
}

export type OpenSeaCollectionListItem = {
  collection: string;
  name?: string | null;
  description?: string | null;
  image_url?: string | null;
  contracts?: Array<{ address: string; chain: string }>;
  owner?: string;
  safelist_status?: string;
  is_disabled?: boolean;
};

type CollectionsPage = {
  collections?: OpenSeaCollectionListItem[];
  next?: string | null;
};

export type OpenSeaCollectionDetail = OpenSeaCollectionListItem & {
  total_supply?: number | null;
  contracts?: Array<{ address: string; chain: string }>;
};

export async function listCollectionsByCreatorUsername(
  username: string,
  options?: { maxPages?: number; includeHidden?: boolean }
): Promise<OpenSeaCollectionListItem[]> {
  const maxPages = options?.maxPages ?? 20;
  const out: OpenSeaCollectionListItem[] = [];
  let next: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const data = await osFetch<CollectionsPage>("/collections", {
      creator_username: username,
      limit: "50",
      include_hidden: options?.includeHidden === false ? "false" : "true",
      next,
    });

    out.push(...(data.collections ?? []));
    if (!data.next) break;
    next = data.next;
  }

  return out;
}

/**
 * Collections linked to an account’s inventory (holds ≥1 token).
 * Filter client-side: collection.owner === artist ⇒ “created by” on OpenSea.
 */
export async function listAccountCollections(
  address: string,
  options?: { maxPages?: number }
): Promise<OpenSeaCollectionListItem[]> {
  const maxPages = options?.maxPages ?? 80;
  const out: OpenSeaCollectionListItem[] = [];
  // Profile collections use `after` cursor (not `next` query param)
  let after: string | undefined;
  let prevCursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const data = await osFetch<CollectionsPage & { after?: string | null }>(
      `/account/${address}/collections`,
      {
        limit: "50",
        after,
      }
    );

    const pageCols = data.collections ?? [];
    out.push(...pageCols);

    const cursor = data.next ?? data.after ?? undefined;
    if (!cursor || cursor === prevCursor || pageCols.length === 0) break;
    prevCursor = cursor;
    after = cursor;
  }

  return out;
}

export async function getOpenSeaCollection(
  slug: string
): Promise<OpenSeaCollectionDetail | null> {
  try {
    return await osFetch<OpenSeaCollectionDetail>(
      `/collections/${encodeURIComponent(slug)}`
    );
  } catch {
    return null;
  }
}

export type OpenSeaCollectionStats = {
  total?: {
    volume?: number;
    sales?: number;
    num_owners?: number;
    floor_price?: number | null;
    floor_price_symbol?: string | null;
  };
};

/** One lightweight request — unique owner count, no holder walk */
export async function getCollectionStats(
  slug: string
): Promise<{ numOwners: number | null; floorPrice: number | null }> {
  try {
    const data = await osFetch<OpenSeaCollectionStats>(
      `/collections/${encodeURIComponent(slug)}/stats`
    );
    const n = data.total?.num_owners;
    return {
      numOwners: typeof n === "number" && Number.isFinite(n) ? n : null,
      floorPrice:
        typeof data.total?.floor_price === "number"
          ? data.total.floor_price
          : null,
    };
  } catch {
    return { numOwners: null, floorPrice: null };
  }
}

type AssetEventsPage = {
  asset_events?: Array<{
    event_type?: string;
    chain?: string;
    nft?: { collection?: string; contract?: string; name?: string | null };
    asset?: { collection?: string; contract?: string };
    collection?: string;
  }>;
  next?: string | null;
};

const MINT_CHAINS = [
  "ethereum",
  "base",
  "optimism",
  "arbitrum",
  "polygon",
  "zora",
] as const;

/**
 * Collect unique OpenSea collection slugs this account has minted into
 * (across chains). Used to find created collections they no longer hold.
 */
export async function listMintedCollectionSlugs(
  address: string,
  options?: { maxPagesPerChain?: number; pageDelayMs?: number }
): Promise<string[]> {
  const maxPages = options?.maxPagesPerChain ?? 25;
  const pageDelayMs = options?.pageDelayMs ?? 200;
  const slugs = new Set<string>();

  for (const chain of MINT_CHAINS) {
    let next: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      if (page > 0 && pageDelayMs > 0) await sleep(pageDelayMs);
      try {
        const data = await osFetch<AssetEventsPage>(
          `/events/accounts/${address}`,
          {
            event_type: "mint",
            chain,
            limit: "50",
            next,
          }
        );
        for (const ev of data.asset_events ?? []) {
          const slug =
            ev.nft?.collection || ev.asset?.collection || ev.collection;
          if (slug) slugs.add(slug);
        }
        if (!data.next) break;
        next = data.next;
      } catch {
        break;
      }
    }
  }

  return [...slugs];
}

export type OpenSeaHolder = {
  address: string;
  quantity?: number;
};

type HoldersPage = {
  holders?: Array<{
    address?: string;
    owner?: string;
    wallet?: string;
    quantity?: number | string;
    balance?: number | string;
  }>;
  next?: string | null;
  next_cursor?: string | null;
};

export async function getOpenSeaCollectionHolders(
  slug: string,
  options?: { maxPages?: number; pageSize?: number; pageDelayMs?: number }
): Promise<{ holders: OpenSeaHolder[]; truncated: boolean }> {
  const maxPages = options?.maxPages ?? 15;
  const pageSize = options?.pageSize ?? 100;
  const pageDelayMs = options?.pageDelayMs ?? 300;
  const holders: OpenSeaHolder[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    if (page > 0 && pageDelayMs > 0) {
      await sleep(pageDelayMs);
    }

    const data = await osFetch<HoldersPage>(
      `/collections/${encodeURIComponent(slug)}/holders`,
      {
        limit: String(pageSize),
        cursor,
      }
    );

    for (const row of data.holders ?? []) {
      const raw = row.address ?? row.owner ?? row.wallet;
      if (!raw || !isAddress(raw)) continue;
      const address = getAddress(raw);
      if (seen.has(address)) continue;
      seen.add(address);
      const q = Number(row.quantity ?? row.balance ?? 1);
      holders.push({
        address,
        quantity: Number.isFinite(q) && q > 0 ? q : 1,
      });
    }

    const next = data.next ?? data.next_cursor ?? undefined;
    if (!next) {
      truncated = false;
      break;
    }
    cursor = next;
    if (page === maxPages - 1) truncated = true;
  }

  return { holders, truncated };
}

export function openSeaChainToSupported(chain: string): SupportedChain | undefined {
  const key = chain
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
  const map: Record<string, string> = {
    ethereum: "ethereum",
    eth: "ethereum",
    mainnet: "ethereum",
    base: "base",
    "base_mainnet": "base",
    optimism: "optimism",
    optimistic_ethereum: "optimism",
    opt: "optimism",
    arbitrum: "arbitrum",
    arbitrum_one: "arbitrum",
    arb: "arbitrum",
    polygon: "polygon",
    matic: "polygon",
    zora: "zora",
    zora_mainnet: "zora",
  };
  return chainByKey(map[key] ?? key);
}

export type DiscoveredOsCollection = {
  slug: string;
  name: string | null;
  imageUrl: string | null;
  contracts: Array<{ chainKey: string; address: string; chainId: number }>;
};

function mapContracts(
  contracts: Array<{ address: string; chain: string }> | undefined
): DiscoveredOsCollection["contracts"] {
  if (!contracts?.length) return [];
  return contracts
    .map((c) => {
      const chain = openSeaChainToSupported(c.chain);
      if (!chain || !isAddress(c.address)) return null;
      return {
        chainKey: chain.key,
        chainId: chain.id,
        address: getAddress(c.address),
      };
    })
    .filter(Boolean) as DiscoveredOsCollection["contracts"];
}

function toDiscovered(item: OpenSeaCollectionListItem): DiscoveredOsCollection | null {
  if (!item.collection || item.is_disabled) return null;
  return {
    slug: item.collection,
    name: item.name ?? null,
    imageUrl: item.image_url ?? null,
    contracts: mapContracts(item.contracts),
  };
}

/**
 * Build username candidates when OS username is null (e.g. visualizevalue.eth).
 */
function usernameCandidates(
  account: OpenSeaAccount,
  artistAddress: string
): string[] {
  const out = new Set<string>();

  if (account.username) out.add(account.username);

  const ens = account.ens_name?.toLowerCase();
  if (ens?.endsWith(".eth")) {
    const label = ens.slice(0, -4);
    if (label && !label.includes(".")) out.add(label);
    const parts = ens.replace(/\.eth$/, "").split(".");
    if (parts.length) out.add(parts[parts.length - 1]!);
  }

  const display = account.display_name?.trim();
  if (display && !display.includes(" ")) {
    const d = display.toLowerCase().replace(/\.eth$/, "");
    if (d && !d.startsWith("0x")) out.add(d);
  }

  void artistAddress;
  return [...out];
}

type GqlCreatedItem = {
  id?: string;
  slug: string;
  name?: string | null;
  imageUrl?: string | null;
  /** Primary collection chain from OpenSea GraphQL */
  address?: string | null;
  chain?: { identifier?: string | null; name?: string | null } | null;
  contracts?: Array<{
    contractAddress?: string | null;
    chain?: { identifier?: string | null; name?: string | null } | null;
  }> | null;
};

/**
 * Same GraphQL field the OpenSea website uses for /{address}/created
 * → exact collection count (e.g. 39 for visualizevalue.eth).
 * Includes chain + contracts so Base / Zora / etc. are not mislabeled as ETH.
 */
export async function listUserCreatedCollectionsGraphQL(
  address: string,
  options?: { pageSize?: number; maxPages?: number }
): Promise<GqlCreatedItem[]> {
  const pageSize = options?.pageSize ?? 50;
  const maxPages = options?.maxPages ?? 20;
  const out: GqlCreatedItem[] = [];
  let after: string | null = null;

  const query = `
    query UserCreated($addresses: [Address!], $limit: Int!, $sort: TopCollectionsSort!, $after: Cursor) {
      userCreatedCollections(
        addresses: $addresses
        limit: $limit
        sort: $sort
        after: $after
      ) {
        items {
          id
          slug
          name
          imageUrl
          address
          chain { identifier name }
          contracts {
            contractAddress
            chain { identifier name }
          }
        }
        nextPageCursor
      }
    }
  `;

  for (let page = 0; page < maxPages; page++) {
    const r = await fetch("https://gql.opensea.io/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
        origin: "https://opensea.io",
        referer: `https://opensea.io/${address}/created`,
      },
      body: JSON.stringify({
        query,
        variables: {
          addresses: [address.toLowerCase()],
          limit: pageSize,
          sort: { by: "VOLUME", direction: "DESC" },
          after,
        },
      }),
      cache: "no-store",
    });

    const json = (await r.json()) as {
      data?: {
        userCreatedCollections?: {
          items?: GqlCreatedItem[];
          nextPageCursor?: string | null;
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message || "GraphQL userCreatedCollections failed");
    }

    const items = json.data?.userCreatedCollections?.items ?? [];
    out.push(...items.filter((i) => i?.slug));

    const cursor = json.data?.userCreatedCollections?.nextPageCursor;
    if (!cursor || !items.length) break;
    after = cursor;
  }

  return out;
}

/**
 * Fallback: parse urql rehydrate payload from the public created page HTML.
 * Same 39 items the UI ships in the first paint for VV.
 */
export async function listUserCreatedCollectionsFromHtml(
  address: string
): Promise<GqlCreatedItem[]> {
  const r = await fetch(`https://opensea.io/${address}/created`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
      accept: "text/html",
    },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`OpenSea created page ${r.status}`);
  const html = await r.text();

  const marker = '"userCreatedCollections":';
  const i = html.indexOf(marker);
  if (i < 0) return [];

  const itemsKey = '"items":[';
  const j = html.indexOf(itemsKey, i);
  if (j < 0) return [];

  const start = j + itemsKey.length - 1;
  let depth = 0;
  let end = -1;
  for (let k = start; k < Math.min(html.length, start + 900_000); k++) {
    const ch = html[k];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = k + 1;
        break;
      }
    }
  }
  if (end < 0) return [];

  try {
    const items = JSON.parse(html.slice(start, end)) as GqlCreatedItem[];
    return items.filter((it) => it?.slug);
  } catch {
    // regex fallback
    const window = html.slice(i, i + 500_000);
    const pairs = [
      ...window.matchAll(
        /"slug":"([a-zA-Z0-9_-]+)","__typename":"Collection","name":("(?:[^"\\]|\\.)*"|null)/g
      ),
    ];
    return pairs.map((m) => ({
      slug: m[1]!,
      name: m[2] === "null" ? null : (JSON.parse(m[2]!) as string),
      imageUrl: null,
    }));
  }
}

function gqlItemToDiscovered(item: GqlCreatedItem): DiscoveredOsCollection {
  const contracts: DiscoveredOsCollection["contracts"] = [];
  const seen = new Set<string>();

  const pushContract = (addressRaw: string | null | undefined, chainRaw: string | null | undefined) => {
    if (!addressRaw || !isAddress(addressRaw)) return;
    const chain = openSeaChainToSupported(chainRaw ?? "");
    if (!chain) return;
    const address = getAddress(addressRaw);
    const key = `${chain.key}:${address.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    contracts.push({
      chainKey: chain.key,
      chainId: chain.id,
      address,
    });
  };

  // Prefer explicit contract list from GraphQL
  for (const c of item.contracts ?? []) {
    pushContract(c.contractAddress, c.chain?.identifier ?? null);
  }

  // Fallback: collection-level address + chain (common single-contract case)
  if (!contracts.length) {
    pushContract(item.address, item.chain?.identifier ?? null);
  }

  // Last resort: chain only (no address) — still fix the displayed chain
  if (!contracts.length && item.chain?.identifier) {
    const chain = openSeaChainToSupported(item.chain.identifier);
    if (chain) {
      contracts.push({
        chainKey: chain.key,
        chainId: chain.id,
        address: `opensea:${item.slug}`,
      });
    }
  }

  // Prefer the collection's primary chain when multiple contracts exist
  const primaryKey = item.chain?.identifier
    ? openSeaChainToSupported(item.chain.identifier)?.key
    : undefined;
  if (primaryKey && contracts.length > 1) {
    contracts.sort((a, b) => {
      if (a.chainKey === primaryKey && b.chainKey !== primaryKey) return -1;
      if (b.chainKey === primaryKey && a.chainKey !== primaryKey) return 1;
      return 0;
    });
  }

  return {
    slug: item.slug,
    name: item.name ?? null,
    imageUrl: item.imageUrl ?? null,
    contracts,
  };
}

export async function discoverOpenSeaCreatedCollections(
  artistAddress: string,
  options?: { maxListPages?: number }
): Promise<{
  collections: DiscoveredOsCollection[];
  username: string | null;
  notes: string[];
  error?: string;
}> {
  const notes: string[] = [];
  const artist = artistAddress.toLowerCase();
  const maxListPages = options?.maxListPages ?? 40;

  // REST key still needed for stats/holders later; GraphQL created list does not require it
  try {
    await resolveOpenSeaApiKey();
  } catch (err) {
    notes.push(
      `REST API key unavailable (${err instanceof Error ? err.message : "error"}) — created list may still work via GraphQL`
    );
  }

  const account = await resolveOpenSeaAccount(artistAddress);
  const primaryUsername = account.username;
  notes.push(
    account.username
      ? `OpenSea username: ${account.username}`
      : account.ens_name
        ? `No OS username (ENS ${account.ens_name})`
        : "No OS username on profile"
  );

  const bySlug = new Map<string, DiscoveredOsCollection>();

  const addDiscovered = (
    items: DiscoveredOsCollection[],
    source: string
  ) => {
    let added = 0;
    for (const d of items) {
      if (!d.slug || bySlug.has(d.slug)) continue;
      bySlug.set(d.slug, d);
      added++;
    }
    if (added) notes.push(`${source}: +${added}`);
  };

  const addRestItems = (
    items: OpenSeaCollectionListItem[],
    source: string
  ) => {
    addDiscovered(
      items
        .map((item) => toDiscovered(item))
        .filter(Boolean) as DiscoveredOsCollection[],
      source
    );
  };

  // —— Path 0 (PRIMARY): same API as opensea.io/{address}/created ——
  try {
    const gqlItems = await listUserCreatedCollectionsGraphQL(artistAddress, {
      pageSize: 50,
      maxPages: maxListPages,
    });
    addDiscovered(
      gqlItems.map(gqlItemToDiscovered),
      `userCreatedCollections GraphQL (${gqlItems.length})`
    );
  } catch (err) {
    notes.push(
      `GraphQL created failed: ${err instanceof Error ? err.message : "error"}`
    );
    try {
      const htmlItems = await listUserCreatedCollectionsFromHtml(artistAddress);
      addDiscovered(
        htmlItems.map(gqlItemToDiscovered),
        `created-page HTML parse (${htmlItems.length})`
      );
    } catch (err2) {
      notes.push(
        `HTML created parse failed: ${
          err2 instanceof Error ? err2.message : "error"
        }`
      );
    }
  }

  // —— Path A: creator_username (fills gaps / works for accounts like ripe0x) ——
  const candidates = usernameCandidates(account, artistAddress);
  for (const uname of candidates) {
    try {
      const listed = await listCollectionsByCreatorUsername(uname, {
        maxPages: maxListPages,
        includeHidden: true,
      });
      const owned = listed.filter(
        (c) => !c.owner || c.owner.toLowerCase() === artist
      );
      const use = owned.length ? owned : listed;
      addRestItems(use, `creator_username=${uname} (${use.length})`);
    } catch (err) {
      notes.push(
        `creator_username=${uname} failed: ${
          err instanceof Error ? err.message : "error"
        }`
      );
    }
  }

  // —— Path B: inventory owner-match (held tokens) ——
  try {
    const held = await listAccountCollections(artistAddress, {
      maxPages: Math.max(maxListPages * 2, 40),
    });
    const created = held.filter(
      (c) => c.owner && c.owner.toLowerCase() === artist
    );
    const before = bySlug.size;
    addRestItems(created, `owner-match inventory rows=${created.length}`);
    notes.push(`owner-match new unique: ${bySlug.size - before}`);
  } catch (err) {
    notes.push(
      `account collections failed: ${
        err instanceof Error ? err.message : "error"
      }`
    );
  }

  const collections = [...bySlug.values()].sort((a, b) =>
    (a.name ?? a.slug).localeCompare(b.name ?? b.slug)
  );

  if (collections.length === 0) {
    return {
      collections: [],
      username: primaryUsername,
      notes,
      error: "No created collections found on OpenSea for this wallet.",
    };
  }

  notes.push(`Total unique created collections: ${collections.length}`);

  return {
    collections,
    username: primaryUsername,
    notes,
  };
}

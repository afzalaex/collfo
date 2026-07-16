import type {
  ArtistCollectorsResponse,
  CollectionSummary,
  CollectorSummary,
} from "./types";
import {
  discoverOpenSeaCreatedCollections,
  getCollectionStats,
  getOpenSeaCollectionHolders,
} from "./providers/opensea";
import { chainByKey } from "./chains";
import { resolveArtistInput, reverseEnsBatch } from "./ens";
import { LIMITS } from "./limits";

export type ResolvedWallet = {
  address: string;
  ens: string | null;
  input: string;
};

export type ArtistDiscovery = {
  /** Primary display address (first wallet) */
  artist: string;
  artistEns: string | null;
  /** All wallets in this search */
  wallets: ResolvedWallet[];
  openseaUsername: string | null;
  message: string;
  status: ArtistCollectorsResponse["status"];
  collections: CollectionSummary[];
  notes: string[];
  /** Sum of per-collection num_owners (not de-duplicated across collections) */
  totalOwnersSum: number;
};

function emptyDiscovery(
  artist: string,
  status: ArtistCollectorsResponse["status"],
  message: string,
  extra?: Partial<ArtistDiscovery>
): ArtistDiscovery {
  return {
    artist,
    artistEns: null,
    wallets: [],
    openseaUsername: null,
    message,
    status,
    collections: [],
    notes: [],
    totalOwnersSum: 0,
    ...extra,
  };
}

async function attachStats(
  jobs: Array<{
    slug: string;
    name: string | null;
    imageUrl: string | null;
    contracts: Array<{ chainKey: string; address: string; chainId: number }>;
  }>
): Promise<{ collections: CollectionSummary[]; totalOwnersSum: number }> {
  const collections: CollectionSummary[] = [];
  let totalOwnersSum = 0;
  const concurrency = 3;
  let cursor = 0;

  async function statsWorker() {
    while (cursor < jobs.length) {
      const i = cursor++;
      const job = jobs[i]!;
      const primary = job.contracts[0];
      const chain = primary ? chainByKey(primary.chainKey) : undefined;
      let numOwners: number | null = null;
      try {
        const stats = await getCollectionStats(job.slug);
        numOwners = stats.numOwners;
        if (typeof numOwners === "number") totalOwnersSum += numOwners;
      } catch {
        /* leave null */
      }
      collections[i] = {
        chainId: chain?.id ?? primary?.chainId ?? 0,
        chainKey: primary?.chainKey ?? "unknown",
        contractAddress: primary?.address ?? `opensea:${job.slug}`,
        name: job.name,
        symbol: null,
        tokenType: "UNKNOWN",
        discovery: "opensea_created",
        openseaSlug: job.slug,
        totalSupply: null,
        uniqueOwners: numOwners,
        imageUrl: job.imageUrl,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length || 1) }, () =>
      statsWorker()
    )
  );

  for (let i = 0; i < jobs.length; i++) {
    if (collections[i]) continue;
    const job = jobs[i]!;
    const primary = job.contracts[0];
    const chain = primary ? chainByKey(primary.chainKey) : undefined;
    collections[i] = {
      chainId: chain?.id ?? primary?.chainId ?? 0,
      chainKey: primary?.chainKey ?? "unknown",
      contractAddress: primary?.address ?? `opensea:${job.slug}`,
      name: job.name,
      symbol: null,
      tokenType: "UNKNOWN",
      discovery: "opensea_created",
      openseaSlug: job.slug,
      totalSupply: null,
      uniqueOwners: null,
      imageUrl: job.imageUrl,
    };
  }

  return { collections, totalOwnersSum };
}

/**
 * Fast path for one or more wallets: merge created collections by slug, then stats.
 */
export async function discoverArtist(
  artistInput: string | string[]
): Promise<ArtistDiscovery> {
  const inputs = (Array.isArray(artistInput) ? artistInput : [artistInput])
    .map((s) => s.trim())
    .filter(Boolean);

  if (!inputs.length) {
    return emptyDiscovery("", "error", "Add at least one wallet or ENS.");
  }

  const resolved: ResolvedWallet[] = [];
  const failed: string[] = [];

  for (const input of inputs) {
    const r = await resolveArtistInput(input);
    if (!r) {
      failed.push(input);
      continue;
    }
    // Dedupe by address
    if (resolved.some((w) => w.address.toLowerCase() === r.address.toLowerCase())) {
      continue;
    }
    resolved.push({ address: r.address, ens: r.ens, input });
  }

  if (!resolved.length) {
    return emptyDiscovery(
      inputs[0] ?? "",
      "error",
      `Could not resolve: ${failed.join(", ")}. Use 0x… or name.eth`
    );
  }

  const notes: string[] = [];
  if (failed.length) {
    notes.push(`Skipped invalid: ${failed.join(", ")}`);
  }
  notes.push(
    resolved.length === 1
      ? `Wallet: ${resolved[0]!.ens ?? resolved[0]!.address}`
      : `Merged ${resolved.length} wallets`
  );

  // Discover per wallet in parallel, merge by collection slug
  const bySlug = new Map<
    string,
    {
      slug: string;
      name: string | null;
      imageUrl: string | null;
      contracts: Array<{ chainKey: string; address: string; chainId: number }>;
    }
  >();
  const usernames: string[] = [];

  const discoveries = await Promise.all(
    resolved.map(async (w) => {
      try {
        const d = await discoverOpenSeaCreatedCollections(w.address, {
          maxListPages: LIMITS.maxCollectionListPages,
        });
        return { w, d };
      } catch (err) {
        return {
          w,
          d: {
            collections: [] as Awaited<
              ReturnType<typeof discoverOpenSeaCreatedCollections>
            >["collections"],
            username: null as string | null,
            notes: [
              `${w.ens ?? w.address}: ${err instanceof Error ? err.message : "failed"}`,
            ],
            error: err instanceof Error ? err.message : "failed",
          },
        };
      }
    })
  );

  for (const { w, d } of discoveries) {
    if (d.username) usernames.push(d.username);
    notes.push(
      ...d.notes.map((n) => `[${w.ens ?? w.address.slice(0, 8)}…] ${n}`)
    );
    for (const c of d.collections) {
      if (!bySlug.has(c.slug)) {
        bySlug.set(c.slug, {
          slug: c.slug,
          name: c.name,
          imageUrl: c.imageUrl,
          contracts: c.contracts,
        });
      }
    }
  }

  const merged = [...bySlug.values()];
  const capped = merged.slice(0, LIMITS.maxCollections);
  if (merged.length > LIMITS.maxCollections) {
    notes.push(
      `Listed ${LIMITS.maxCollections} of ${merged.length} collections.`
    );
  }

  if (!capped.length) {
    return emptyDiscovery(resolved[0]!.address, "partial", "No created collections found.", {
      artistEns: resolved[0]!.ens,
      wallets: resolved,
      notes,
      openseaUsername: usernames[0] ?? null,
    });
  }

  const { collections, totalOwnersSum } = await attachStats(capped);

  const primary = resolved[0]!;
  const walletLabel =
    resolved.length === 1
      ? primary.ens ?? primary.address
      : `${resolved.length} wallets`;

  return {
    artist: primary.address,
    artistEns: primary.ens,
    wallets: resolved,
    openseaUsername: usernames[0] ?? null,
    status: "ready",
    message: [
      `Found ${collections.length} created collection(s) for ${walletLabel}.`,
      totalOwnersSum > 0
        ? `Σ OpenSea owners ≈ ${totalOwnersSum.toLocaleString("en-US")} (upper bound, not unique).`
        : "",
      resolved.length > 1
        ? resolved
            .map((w) => w.ens ?? `${w.address.slice(0, 6)}…${w.address.slice(-4)}`)
            .join(" · ")
        : "",
      "Next: calculate unique collectors and/or load full collector details.",
    ]
      .filter(Boolean)
      .join(" "),
    collections,
    notes,
    totalOwnersSum,
  };
}

export type CollectionHoldersResult = {
  slug: string;
  holders: Array<{ address: string; quantity: number }>;
  uniqueOwners: number;
  /** True when more OpenSea pages remain — client should pass nextCursor */
  hasMore: boolean;
  nextCursor: string | null;
  pagesFetched: number;
  /** @deprecated use hasMore — kept so older clients still typecheck */
  truncated: boolean;
};

/**
 * One chunk of holders for a collection (cursor-resumable).
 * Client loops with nextCursor until hasMore is false for an exact full list.
 */
export async function fetchHoldersForCollection(
  slug: string,
  options?: { maxPages?: number; cursor?: string | null }
): Promise<CollectionHoldersResult> {
  const maxPages =
    options?.maxPages ??
    LIMITS.maxHolderPagesPerRequest ??
    LIMITS.maxHolderPages;
  const pageSize = 100;

  const { holders, hasMore, nextCursor, pagesFetched } =
    await getOpenSeaCollectionHolders(slug, {
      maxPages,
      pageSize,
      pageDelayMs: LIMITS.holderPageDelayMs,
      cursor: options?.cursor,
    });

  return {
    slug,
    holders: holders.map((h) => ({
      address: h.address,
      quantity: h.quantity ?? 1,
    })),
    uniqueOwners: holders.length,
    hasMore,
    nextCursor,
    pagesFetched,
    truncated: hasMore,
  };
}

export async function resolveEnsForAddresses(
  addresses: string[],
  max = LIMITS.maxEnsLookups
): Promise<Record<string, string | null>> {
  const slice = addresses.slice(0, max);
  const map = await reverseEnsBatch(slice, { concurrency: 8 });
  const out: Record<string, string | null> = {};
  for (const [k, v] of map) out[k] = v;
  return out;
}

/** Merge helper for progressive client (also used if needed server-side). */
export function mergeCollectorMaps(
  base: Map<
    string,
    {
      collectionCount: number;
      tokenCount: number;
      chains: Set<string>;
      collections: Set<string>;
    }
  >,
  holders: Array<{ address: string; quantity: number }>,
  colKey: string,
  chainKey: string
): void {
  for (const h of holders) {
    let row = base.get(h.address);
    if (!row) {
      row = {
        collectionCount: 0,
        tokenCount: 0,
        chains: new Set(),
        collections: new Set(),
      };
      base.set(h.address, row);
    }
    if (!row.collections.has(colKey)) {
      row.collectionCount += 1;
      row.collections.add(colKey);
    }
    row.tokenCount += h.quantity;
    row.chains.add(chainKey);
  }
}

export function mapToCollectorSummaries(
  map: Map<
    string,
    {
      collectionCount: number;
      tokenCount: number;
      chains: Set<string>;
      collections: Set<string>;
    }
  >,
  ensMap?: Record<string, string | null>
): CollectorSummary[] {
  return [...map.entries()]
    .map(([address, row]) => ({
      address,
      ens: ensMap?.[address] ?? null,
      collectionCount: row.collectionCount,
      tokenCount: Math.round(row.tokenCount * 1000) / 1000,
      chains: [...row.chains].sort(),
      collections: [...row.collections],
    }))
    .sort((a, b) => {
      if (b.collectionCount !== a.collectionCount) {
        return b.collectionCount - a.collectionCount;
      }
      return b.tokenCount - a.tokenCount;
    });
}

/**
 * Full one-shot load (API/debug). Prefer progressive UI for big artists.
 */
export async function getArtistCollectors(
  artistInput: string
): Promise<ArtistCollectorsResponse> {
  const discovery = await discoverArtist(artistInput);

  if (discovery.status === "error" || discovery.collections.length === 0) {
    return {
      artist: discovery.artist,
      artistEns: discovery.artistEns,
      generatedAt: new Date().toISOString(),
      status: discovery.status,
      message: discovery.message,
      openseaUsername: discovery.openseaUsername,
      chainsQueried: ["opensea"],
      stats: {
        collections: discovery.collections.length,
        uniqueCollectors: 0,
        totalHoldings: 0,
      },
      collections: discovery.collections,
      collectors: [],
    };
  }

  // Sequential only — never parallel for one-shot either
  const collectorMap = new Map<
    string,
    {
      collectionCount: number;
      tokenCount: number;
      chains: Set<string>;
      collections: Set<string>;
    }
  >();
  const collections = [...discovery.collections];
  const warnings: string[] = [];

  for (let i = 0; i < collections.length; i++) {
    const col = collections[i]!;
    const slug = col.openseaSlug;
    if (!slug) continue;
    try {
      // Exact walk: chunk until OpenSea has no more pages
      const allHolders: Array<{ address: string; quantity: number }> = [];
      const seen = new Set<string>();
      let cursor: string | null = null;
      let complete = false;
      for (let chunk = 0; chunk < 200; chunk++) {
        const result = await fetchHoldersForCollection(slug, { cursor });
        for (const h of result.holders) {
          if (seen.has(h.address)) continue;
          seen.add(h.address);
          allHolders.push(h);
        }
        if (!result.hasMore || !result.nextCursor) {
          complete = true;
          break;
        }
        cursor = result.nextCursor;
      }
      collections[i] = { ...col, uniqueOwners: allHolders.length };
      mergeCollectorMaps(
        collectorMap,
        allHolders,
        `slug:${slug}`,
        col.chainKey
      );
      if (!complete) {
        warnings.push(`${slug}: holder walk hit safety cap`);
      }
      if (i < collections.length - 1 && LIMITS.collectionGapMs > 0) {
        await new Promise((r) => setTimeout(r, LIMITS.collectionGapMs));
      }
    } catch (err) {
      warnings.push(
        `${slug}: ${err instanceof Error ? err.message : "holders failed"}`
      );
    }
  }

  const ranked = mapToCollectorSummaries(collectorMap);
  const ensMap = await resolveEnsForAddresses(
    ranked.slice(0, LIMITS.maxEnsLookups).map((c) => c.address)
  );
  const collectors = ranked.map((c) => ({
    ...c,
    ens: ensMap[c.address] ?? null,
  }));

  const totalHoldings = collectors.reduce((s, c) => s + c.tokenCount, 0);

  return {
    artist: discovery.artist,
    artistEns: discovery.artistEns,
    generatedAt: new Date().toISOString(),
    status: warnings.length ? "partial" : "ready",
    message: [
      `Found ${collections.length} collection(s), ${collectorMap.size} unique collector(s).`,
      discovery.artistEns ? `Artist ENS: ${discovery.artistEns}.` : "",
      warnings.slice(0, 4).join(" · "),
    ]
      .filter(Boolean)
      .join(" "),
    openseaUsername: discovery.openseaUsername,
    chainsQueried: ["opensea"],
    stats: {
      collections: collections.length,
      uniqueCollectors: collectorMap.size,
      totalHoldings: Math.round(totalHoldings * 1000) / 1000,
    },
    collections,
    collectors,
  };
}

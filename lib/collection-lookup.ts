import type { CollectionSummary } from "./types";
import {
  getCollectionStats,
  getOpenSeaCollection,
  openSeaChainToSupported,
} from "./providers/opensea";
import { getAddress, isAddress } from "viem";

export type LookupResult = {
  collection: CollectionSummary | null;
  slug: string;
  error?: string;
};

/**
 * Resolve one OpenSea collection slug → CollectionSummary (+ stats owners).
 */
export async function lookupOpenSeaCollection(
  slugRaw: string
): Promise<LookupResult> {
  const slug = slugRaw.trim().toLowerCase();
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    return { collection: null, slug, error: "Invalid slug" };
  }

  if (isAddress(slug)) {
    return lookupCustomContract(slug);
  }

  const detail = await getOpenSeaCollection(slug);
  if (!detail || detail.is_disabled) {
    return {
      collection: null,
      slug,
      error: detail?.is_disabled
        ? "Collection is disabled on OpenSea"
        : "Collection not found on OpenSea",
    };
  }

  const contracts = (detail.contracts ?? [])
    .map((c) => {
      const chain = openSeaChainToSupported(c.chain);
      if (!chain || !isAddress(c.address)) return null;
      return {
        chainKey: chain.key,
        chainId: chain.id,
        address: getAddress(c.address),
      };
    })
    .filter(Boolean) as Array<{
    chainKey: string;
    chainId: number;
    address: string;
  }>;

  const primary = contracts[0];
  let numOwners: number | null = null;
  try {
    const stats = await getCollectionStats(slug);
    numOwners = stats.numOwners;
  } catch {
    /* leave null */
  }

  return {
    slug,
    collection: {
      chainId: primary?.chainId ?? 0,
      chainKey: primary?.chainKey ?? "unknown",
      contractAddress: primary?.address ?? `opensea:${slug}`,
      name: detail.name ?? slug,
      symbol: null,
      tokenType: "UNKNOWN",
      discovery: "user_added",
      openseaSlug: detail.collection || slug,
      totalSupply:
        typeof detail.total_supply === "number" ? detail.total_supply : null,
      estimatedOwners: numOwners,
      uniqueOwners: null,
      imageUrl: detail.image_url ?? null,
    },
  };
}

export async function lookupOpenSeaCollections(
  slugs: string[]
): Promise<LookupResult[]> {
  const out: LookupResult[] = [];
  // Sequential to be gentle on OpenSea rate limits
  for (const slug of slugs) {
    out.push(await lookupOpenSeaCollection(slug));
  }
  return out;
}

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

async function lookupCustomContract(address: string): Promise<LookupResult> {
  let name = address;
  let estimatedOwners: number | null = null;
  let totalSupply: number | null = null;

  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http("https://ethereum-rpc.publicnode.com"),
    });
    const abi = parseAbi([
      "function name() view returns (string)",
      "function totalSupply() view returns (uint256)"
    ]);
    
    const [nameRes, supplyRes] = await Promise.allSettled([
      client.readContract({ address: address as `0x${string}`, abi, functionName: "name" }),
      client.readContract({ address: address as `0x${string}`, abi, functionName: "totalSupply" })
    ]);

    if (nameRes.status === "fulfilled" && nameRes.value) {
      name = nameRes.value;
    }
    if (supplyRes.status === "fulfilled" && supplyRes.value !== undefined) {
      totalSupply = Number(supplyRes.value);
      estimatedOwners = totalSupply; // Fallback estimate
    }
  } catch (err) {
    console.warn("RPC contract lookup failed:", err);
  }

  // Use Etherscan to fetch contract name if RPC failed
  if (name === address) {
    try {
      const key = process.env.ETHERSCAN_API_KEY;
      if (key) {
      const res = await fetch(`https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${address}&apikey=${key}`);
      const data = await res.json();
      if (data.status === "1" && data.result?.[0]?.ContractName) {
        name = data.result[0].ContractName;
      }
    }
  } catch (err) {
    console.error("Etherscan lookup error:", err);
  }
}

  return {
    slug: address,
    collection: {
      chainId: 1,
      chainKey: "ethereum",
      contractAddress: address,
      name,
      symbol: null,
      tokenType: "UNKNOWN",
      discovery: "user_added",
      openseaSlug: null, // this signals it's a custom contract!
      totalSupply,
      estimatedOwners,
      uniqueOwners: null,
      imageUrl: null,
    },
  };
}

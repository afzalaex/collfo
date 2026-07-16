import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { getAddress, isAddress } from "viem";

let client: PublicClient | null = null;

function ensClient(): PublicClient {
  if (!client) {
    const rpc =
      process.env.ETH_RPC_URL?.trim() ||
      "https://ethereum.publicnode.com";
    client = createPublicClient({
      chain: mainnet,
      transport: http(rpc),
    });
  }
  return client;
}

export function looksLikeEns(input: string): boolean {
  const s = input.trim().toLowerCase();
  return s.endsWith(".eth") && s.length > 4 && !s.includes(" ");
}

/**
 * Resolve user input: 0x address or ENS name → checksum address.
 */
export async function resolveArtistInput(
  input: string
): Promise<{ address: string; ens: string | null } | null> {
  const raw = input.trim();
  if (!raw) return null;

  if (isAddress(raw)) {
    const address = getAddress(raw);
    const ens = await reverseEns(address);
    return { address, ens };
  }

  if (looksLikeEns(raw)) {
    try {
      const name = normalize(raw);
      const addr = await ensClient().getEnsAddress({ name });
      if (!addr || !isAddress(addr)) return null;
      return { address: getAddress(addr), ens: name };
    } catch {
      return null;
    }
  }

  return null;
}

export async function reverseEns(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  try {
    const name = await ensClient().getEnsName({
      address: getAddress(address) as Address,
    });
    return name ?? null;
  } catch {
    return null;
  }
}

/**
 * Reverse-resolve many addresses with limited concurrency.
 */
export async function reverseEnsBatch(
  addresses: string[],
  options?: { concurrency?: number }
): Promise<Map<string, string | null>> {
  const concurrency = options?.concurrency ?? 8;
  const out = new Map<string, string | null>();
  let i = 0;

  async function worker() {
    while (i < addresses.length) {
      const idx = i++;
      const addr = addresses[idx];
      out.set(addr, await reverseEns(addr));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, addresses.length) }, () =>
      worker()
    )
  );

  return out;
}

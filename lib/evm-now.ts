/**
 * Links into https://evm.now — open-source EVM contract reader.
 * @see https://github.com/evmnow/dapp
 *
 * Path: /address/{0x…}
 * Optional dappspec RPC seed so the reader opens on the right chain:
 *   ?ds-rpc-{chainId}={rpc}
 */

const PUBLIC_RPC: Record<number, string> = {
  1: "https://cloudflare-eth.com",
  8453: "https://mainnet.base.org",
  10: "https://mainnet.optimism.io",
  42161: "https://arb1.arbitrum.io/rpc",
  7777777: "https://rpc.zora.energy",
  137: "https://polygon-rpc.com",
};

export function isEvmContractAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function evmNowAddressUrl(
  address: string,
  chainId?: number | null
): string | null {
  const a = address.trim();
  if (!isEvmContractAddress(a)) return null;

  const url = new URL(`https://evm.now/address/${a}`);
  if (chainId && PUBLIC_RPC[chainId]) {
    url.searchParams.set(`ds-rpc-${chainId}`, PUBLIC_RPC[chainId]);
  }
  return url.toString();
}

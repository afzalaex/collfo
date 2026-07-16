/**
 * Chain labels for OpenSea contract.chain → display.
 */
export type SupportedChain = {
  id: number;
  key: string;
  name: string;
  shortName: string;
  explorer: string;
};

export const SUPPORTED_CHAINS: SupportedChain[] = [
  {
    id: 1,
    key: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    explorer: "https://etherscan.io",
  },
  {
    id: 8453,
    key: "base",
    name: "Base",
    shortName: "Base",
    explorer: "https://basescan.org",
  },
  {
    id: 10,
    key: "optimism",
    name: "Optimism",
    shortName: "OP",
    explorer: "https://optimistic.etherscan.io",
  },
  {
    id: 42161,
    key: "arbitrum",
    name: "Arbitrum One",
    shortName: "ARB",
    explorer: "https://arbiscan.io",
  },
  {
    id: 7777777,
    key: "zora",
    name: "Zora",
    shortName: "Zora",
    explorer: "https://explorer.zora.energy",
  },
  {
    id: 137,
    key: "polygon",
    name: "Polygon",
    shortName: "POL",
    explorer: "https://polygonscan.com",
  },
];

export function chainById(id: number): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id);
}

export function chainByKey(key: string): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.key === key);
}

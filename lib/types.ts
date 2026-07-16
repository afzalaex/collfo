export type CollectionSummary = {
  chainId: number;
  chainKey: string;
  contractAddress: string;
  name: string | null;
  symbol: string | null;
  tokenType: "ERC721" | "ERC1155" | "UNKNOWN";
  discovery: "opensea_created" | "user_added";
  openseaSlug?: string | null;
  totalSupply: number | null;
  uniqueOwners: number | null;
  imageUrl: string | null;
};

export type CollectorSummary = {
  address: string;
  ens: string | null;
  /** Distinct created collections this wallet holds */
  collectionCount: number;
  tokenCount: number;
  chains: string[];
  collections: string[];
};

export type ArtistCollectorsResponse = {
  artist: string;
  artistEns: string | null;
  generatedAt: string;
  status: "ready" | "partial" | "stub" | "error";
  message?: string;
  openseaUsername?: string | null;
  chainsQueried: string[];
  stats: {
    collections: number;
    uniqueCollectors: number;
    totalHoldings: number;
  };
  collections: CollectionSummary[];
  collectors: CollectorSummary[];
};

/**
 * Caps + pacing for OpenSea rate limits.
 * Big artists load holders collection-by-collection (see ProgressiveCollectors).
 */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const LIMITS = {
  /** Max created collections to queue for holder loading */
  maxCollections: intEnv("COLLECTORFO_MAX_COLLECTIONS", 200),
  /** Pages of collection discovery from OpenSea */
  maxCollectionListPages: intEnv("COLLECTORFO_MAX_COLLECTION_PAGES", 40),
  /** Holder pages per collection (100 per page) — one collection at a time */
  maxHolderPages: intEnv("COLLECTORFO_MAX_HOLDER_PAGES", 100),
  /** Delay between holder page requests (ms) to stay under rate limits */
  holderPageDelayMs: intEnv("COLLECTORFO_HOLDER_PAGE_DELAY_MS", 250),
  /** Delay between finishing one collection and starting the next (ms) */
  collectionGapMs: intEnv("COLLECTORFO_COLLECTION_GAP_MS", 800),
  /** Reverse-ENS for top collectors after load (or on demand) */
  maxEnsLookups: intEnv("COLLECTORFO_MAX_ENS_LOOKUPS", 400),
  /** Collectors table page size */
  collectorsPageSize: intEnv("COLLECTORFO_COLLECTORS_PAGE_SIZE", 100),
};

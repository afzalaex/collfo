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
  maxCollections: intEnv("COLLFO_MAX_COLLECTIONS", 200),
  /** Pages of collection discovery from OpenSea */
  maxCollectionListPages: intEnv("COLLFO_MAX_COLLECTION_PAGES", 40),
  /**
   * Holder pages per server request chunk (100 wallets/page).
   * Client continues with nextCursor until OpenSea is exhausted (exact counts).
   * Keep modest so each Vercel invocation stays under maxDuration.
   */
  maxHolderPagesPerRequest: intEnv("COLLFO_HOLDER_PAGES_PER_REQUEST", 40),
  /**
   * Absolute safety cap on total holder pages per collection across all chunks.
   * Default ~500k wallets (5000 * 100). Raise via env if a collection is larger.
   * Set very high so “exact” is the normal path for real collections.
   */
  maxHolderPagesTotal: intEnv("COLLFO_MAX_HOLDER_PAGES_TOTAL", 5000),
  /** @deprecated use maxHolderPagesPerRequest — kept for older env names */
  maxHolderPages: intEnv("COLLFO_MAX_HOLDER_PAGES", 40),
  /** Delay between holder page requests (ms) to stay under rate limits */
  holderPageDelayMs: intEnv("COLLFO_HOLDER_PAGE_DELAY_MS", 250),
  /** Delay between finishing one collection and starting the next (ms) */
  collectionGapMs: intEnv("COLLFO_COLLECTION_GAP_MS", 800),
  /** Reverse-ENS for top collectors after load (or on demand) */
  maxEnsLookups: intEnv("COLLFO_MAX_ENS_LOOKUPS", 400),
  /** Collectors table page size */
  collectorsPageSize: intEnv("COLLFO_COLLECTORS_PAGE_SIZE", 100),
};

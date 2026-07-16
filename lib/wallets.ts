/**
 * Multi-wallet query encoding for /artist/[... ] routes.
 * Separators in URL: comma. UI uses Enter to add chips.
 */

export function splitWalletQuery(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join for path: encodeURIComponent of comma-separated list */
export function encodeWalletsForPath(wallets: string[]): string {
  return encodeURIComponent(wallets.map((w) => w.trim()).filter(Boolean).join(","));
}

export function parseWalletsFromPath(param: string): string[] {
  const decoded = decodeURIComponent(param);
  return splitWalletQuery(decoded);
}

export function looksLikeWalletOrEns(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^0x[a-fA-F0-9]{40}$/.test(t)) return true;
  if (/\.eth$/i.test(t) && t.length > 4 && !t.includes(" ")) return true;
  return false;
}

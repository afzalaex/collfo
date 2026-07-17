/**
 * Multi-wallet query encoding for /artist/[... ] routes.
 * Separators in URL: comma. UI uses Enter to add chips.
 */

import { shortenAddress } from "./address";

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
  if (/^[a-zA-Z0-9_-]{2,30}$/.test(t)) return true;
  return false;
}

export function formatWalletLabel(w: { address: string; ens?: string | null; input?: string }) {
  if (w.ens) return w.ens;
  if (w.input && !w.input.toLowerCase().startsWith("0x")) return w.input;
  return shortenAddress(w.address, 4);
}

export function formatMultiWalletTitle(wallets: { address: string; ens?: string | null; input?: string }[]) {
  const names = wallets.map(w => {
    if (w.ens) return w.ens;
    if (w.input && !w.input.toLowerCase().startsWith("0x")) return w.input;
    return null;
  }).filter(Boolean);
  
  if (names.length === 0) return "Type name";
  if (names.length === 2) return names.join(" & ");
  return names.join(", ");
}

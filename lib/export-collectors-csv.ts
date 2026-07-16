import type { CollectorSummary } from "./types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Build a CSV string for collector rows (Excel-friendly UTF-8).
 */
export function collectorsToCsv(rows: CollectorSummary[]): string {
  const header = [
    "address",
    "ens",
    "collections_held",
    "tokens",
    "chains",
  ].join(",");

  const lines = rows.map((r) =>
    [
      csvEscape(r.address),
      csvEscape(r.ens ?? ""),
      String(r.collectionCount),
      String(r.tokenCount),
      csvEscape(r.chains.join("|")),
    ].join(",")
  );

  // BOM helps Excel open UTF-8 correctly
  return `\uFEFF${[header, ...lines].join("\n")}\n`;
}

export function downloadCollectorsCsv(
  rows: CollectorSummary[],
  filenameBase = "collectors"
): void {
  const safe = filenameBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const name = `collectorfo-${safe || "collectors"}.csv`;
  const blob = new Blob([collectorsToCsv(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

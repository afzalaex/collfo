/**
 * Parse user input into OpenSea collection slugs.
 * Accepts plain slugs and opensea.io/collection/… URLs.
 * Separators: space, comma, newline.
 */
export function parseOpenSeaCollectionInputs(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const slugs: string[] = [];
  for (const part of parts) {
    const url = part.match(
      /(?:https?:\/\/)?(?:www\.)?opensea\.io\/collection\/([a-zA-Z0-9_-]+)/i
    );
    if (url?.[1]) {
      slugs.push(url[1].toLowerCase());
      continue;
    }

    // Plain slug (no path junk)
    const cleaned = part
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .split("/")
      .pop();
    if (cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
      slugs.push(cleaned.toLowerCase());
    }
  }

  return [...new Set(slugs)];
}

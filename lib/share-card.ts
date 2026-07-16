import { toPng } from "html-to-image";

export const MARKETING_URL = "https://collectorfo.aex.design";

export async function captureElementPng(el: HTMLElement): Promise<string> {
  // Wait a frame so layout/fonts settle before rasterizing
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => resolve())
  );
  return toPng(el, {
    pixelRatio: 2,
    backgroundColor: "#000000",
    cacheBust: true,
    // Skip offscreen / zero-size nodes that can break capture
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.dataset.shareIgnore;
    },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
      return false;
    }
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export function openTweetIntent(text: string, url: string = MARKETING_URL) {
  const intent = new URL("https://twitter.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  window.open(intent.toString(), "_blank", "noopener,noreferrer");
}

export function buildTweetText(opts: {
  label: string;
  collections: number;
  owners: number;
  unique: number;
}): string {
  const { label, collections, owners, unique } = opts;
  const count =
    unique > 0
      ? `${unique.toLocaleString("en-US")} unique collectors`
      : owners > 0
        ? `~${owners.toLocaleString("en-US")} owners`
        : "collectors";

  return [
    `${label} · ${count} across ${collections.toLocaleString("en-US")} collection${collections === 1 ? "" : "s"} on Ethereum & L2s.`,
    "",
    "Find every collector of an artist with Collectorfo",
  ].join("\n");
}

export function shareFilename(label: string): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `collectorfo-${safe || "artist"}.png`;
}

const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";

// Get HTML + find all script chunks
const html = await (
  await fetch(`https://opensea.io/${addr}/created`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
    },
  })
).text();

// Extract full userCreatedCollections JSON blob
const start = html.indexOf('"userCreatedCollections":');
const slice = html.slice(start, start + 500000);
// try to parse items by regex name+slug
const items = [
  ...slice.matchAll(
    /"slug":"([a-zA-Z0-9_-]+)","__typename":"Collection","name":("([^"\\]|\\.)*"|null)/g
  ),
];
console.log("regex items", items.length);
const pairs = items.map((m) => ({
  slug: m[1],
  name: m[2] === "null" ? null : JSON.parse(m[2]),
}));
const uniq = new Map(pairs.map((p) => [p.slug, p.name]));
console.log("unique", uniq.size);
console.log([...uniq.entries()].map(([s, n]) => `${s} — ${n}`).join("\n"));

// Find chunk that mentions userCreatedCollections
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
  (m) => m[0]
);
console.log("\nchunks", chunks.length);

let found = 0;
for (const path of chunks) {
  if (found >= 3) break;
  try {
    const js = await (
      await fetch("https://opensea.io" + path, {
        headers: { "user-agent": "Mozilla/5.0" },
      })
    ).text();
    if (!js.includes("userCreatedCollections")) continue;
    found++;
    console.log("FOUND", path, js.length);
    const i = js.indexOf("userCreatedCollections");
    console.log(js.slice(Math.max(0, i - 400), i + 800));
  } catch {
    /* */
  }
}
console.log("found chunks", found);

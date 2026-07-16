import { readFileSync, existsSync } from "node:fs";

function getKey() {
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (line.startsWith("OPENSEA_API_KEY=")) return line.slice(16).trim();
    }
  }
  if (existsSync(".opensea-key.json")) {
    return JSON.parse(readFileSync(".opensea-key.json", "utf8")).api_key;
  }
  return null;
}

const key = getKey();
const h = { "x-api-key": key, accept: "application/json" };
const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";

const bySlug = new Map();
let after;
let pages = 0;

for (let p = 0; p < 100; p++) {
  const url = new URL(
    `https://api.opensea.io/api/v2/account/${addr}/collections`
  );
  url.searchParams.set("limit", "50");
  if (after) url.searchParams.set("after", after);
  const r = await fetch(url, { headers: h });
  const j = await r.json();
  pages++;
  const cols = j.collections || [];
  if (!cols.length) {
    console.log("empty page", pages, Object.keys(j));
    break;
  }
  for (const c of cols) {
    if ((c.owner || "").toLowerCase() !== addr) continue;
    if (!bySlug.has(c.collection)) {
      bySlug.set(c.collection, {
        slug: c.collection,
        name: c.name,
        owner: c.owner,
        contracts: c.contracts,
      });
    }
  }
  after = j.next || j.after || null;
  // also check response for cursor fields
  if (p === 0) console.log("page0 meta", { keys: Object.keys(j), after, next: j.next });
  if (!after) break;
}

console.log({ pages, uniqueCreated: bySlug.size });
console.log([...bySlug.values()].map((c) => c.slug + " — " + c.name));

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

let next;
let pages = 0;
const createdish = [];
const sample = [];

for (let p = 0; p < 20; p++) {
  const url = new URL(
    `https://api.opensea.io/api/v2/account/${addr}/collections`
  );
  url.searchParams.set("limit", "50");
  if (next) url.searchParams.set("next", next);
  const r = await fetch(url, { headers: h });
  const j = await r.json();
  pages++;
  for (const c of j.collections || []) {
    if (sample.length < 3) sample.push(c);
    // collection-level owner?
    const owner = (c.owner || c.collection_owner || c.creator || "").toLowerCase();
    if (owner === addr) {
      createdish.push({
        slug: c.collection,
        name: c.name,
        owner,
      });
    }
  }
  next = j.next;
  if (!next) break;
}

console.log("pages", pages, "createdish", createdish.length);
console.log("sample keys", sample[0] ? Object.keys(sample[0]) : null);
console.log("sample0", JSON.stringify(sample[0], null, 2).slice(0, 800));
console.log("createdish", createdish.slice(0, 30));

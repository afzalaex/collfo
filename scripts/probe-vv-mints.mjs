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
const chains = [
  "ethereum",
  "base",
  "optimism",
  "arbitrum",
  "polygon",
  "zora",
];

const byCollection = new Map();

for (const chain of chains) {
  let next;
  let pages = 0;
  for (let p = 0; p < 30; p++) {
    const url = new URL(
      `https://api.opensea.io/api/v2/events/accounts/${addr}`
    );
    url.searchParams.set("event_type", "mint");
    url.searchParams.set("chain", chain);
    url.searchParams.set("limit", "50");
    if (next) url.searchParams.set("next", next);
    const r = await fetch(url, { headers: h });
    if (!r.ok) {
      console.log(chain, "events", r.status, (await r.text()).slice(0, 120));
      break;
    }
    const j = await r.json();
    pages++;
    for (const ev of j.asset_events || []) {
      const slug =
        ev.nft?.collection ||
        ev.asset?.collection ||
        ev.collection ||
        null;
      const contract =
        ev.nft?.contract || ev.asset?.contract || ev.contract || null;
      if (slug) {
        byCollection.set(slug, {
          chain,
          contract,
          name: ev.nft?.name || slug,
        });
      }
    }
    next = j.next;
    if (!next) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(chain, "mint pages", pages, "running unique", byCollection.size);
}

console.log("total mint collections", byCollection.size);
console.log([...byCollection.entries()].map(([s, v]) => `${s} @${v.chain}`));

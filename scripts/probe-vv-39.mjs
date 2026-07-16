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
const main = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";
const hot = "0x1d4c8282a408d8fe92496cccd1eaa4ff0fdd3b97";

async function ownedCreated(addr) {
  const bySlug = new Map();
  let after;
  let pages = 0;
  for (let p = 0; p < 300; p++) {
    const url = new URL(`https://api.opensea.io/api/v2/account/${addr}/collections`);
    url.searchParams.set("limit", "50");
    if (after) url.searchParams.set("after", after);
    const r = await fetch(url, { headers: h });
    const j = await r.json();
    pages++;
    for (const c of j.collections || []) {
      if ((c.owner || "").toLowerCase() === addr.toLowerCase()) {
        bySlug.set(c.collection, c.name);
      }
    }
    after = j.next;
    if (!after) break;
  }
  return { pages, count: bySlug.size, slugs: [...bySlug.keys()] };
}

async function creatorUser(u) {
  const all = [];
  let next;
  for (let p = 0; p < 50; p++) {
    const url = new URL("https://api.opensea.io/api/v2/collections");
    url.searchParams.set("creator_username", u);
    url.searchParams.set("limit", "50");
    url.searchParams.set("include_hidden", "true");
    if (next) url.searchParams.set("next", next);
    const r = await fetch(url, { headers: h });
    const j = await r.json();
    all.push(...(j.collections || []));
    next = j.next;
    if (!next) break;
  }
  return all;
}

const a = await ownedCreated(main);
const b = await ownedCreated(hot);
const cu = await creatorUser("visualizevalue");

console.log("main owned-created", a.count, a.pages);
console.log("hot owned-created", b.count, b.pages);
console.log("creator visualizevalue", cu.length);

const merged = new Set([...a.slugs, ...b.slugs, ...cu.map((c) => c.collection)]);
console.log("merged unique", merged.size);

// scrape created tab for collection links
const page = await fetch(
  "https://opensea.io/0xc8f8e2F59Dd95fF67c3d39109ecA2e2A017D4c8a?tab=created",
  {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
      accept: "text/html",
    },
  }
);
const html = await page.text();
const slugs = new Set(
  [...html.matchAll(/\/collection\/([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase())
);
console.log("html collection slugs", slugs.size);
// filter likely noise
const noise = new Set(["create", "ranking", "drops"]);
const clean = [...slugs].filter((s) => !noise.has(s) && s.length > 2);
console.log("clean slugs sample", clean.slice(0, 40));
console.log("clean count", clean.length);

// which clean not in merged
const missing = clean.filter((s) => !merged.has(s));
console.log("in html not in api", missing.length, missing.slice(0, 30));

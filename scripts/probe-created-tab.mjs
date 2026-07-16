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
const h = {
  "x-api-key": key,
  accept: "application/json",
  "user-agent": "Mozilla/5.0",
};
const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";

// Try every plausible "created collections by address" shape
const tries = [
  `/api/v2/collections?creator_address=${addr}&limit=50&include_hidden=true`,
  `/api/v2/collections?owner=${addr}&limit=50&include_hidden=true`,
  `/api/v2/collections?collection_owner=${addr}&limit=50`,
  `/api/v2/accounts/${addr}/created_collections?limit=50`,
  `/api/v2/accounts/${addr}/collections?limit=50`,
  `/api/v2/account/${addr}/created?limit=50`,
  `/api/v2/account/${addr}/collections?limit=50&include_hidden=true`,
  `/api/v2/collections?editor=${addr}&limit=50`,
  `/api/v2/collections?fee_recipient=${addr}&limit=50`,
];

for (const path of tries) {
  const r = await fetch("https://api.opensea.io" + path, { headers: h });
  const t = await r.text();
  let count = "?";
  try {
    const j = JSON.parse(t);
    count = j.collections?.length ?? j.results?.length ?? Object.keys(j).join(",");
  } catch {
    count = t.slice(0, 80);
  }
  console.log(r.status, path.slice(0, 90), "→", count);
}

// Fetch live created page and extract collection slugs from RSC/flight payloads
const pageUrl = `https://opensea.io/${addr}/created`;
const page = await fetch(pageUrl, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml",
  },
});
const html = await page.text();
console.log("\ncreated page", page.status, html.length);

// Look for JSON-looking collection arrays
const slugHits = [
  ...html.matchAll(/"collection"\s*:\s*"([a-zA-Z0-9_-]+)"/g),
].map((m) => m[1]);
const unique = [...new Set(slugHits)];
console.log("json collection fields", unique.length, unique.slice(0, 50));

// Next.js RSC often embeds data differently
for (const needle of [
  "createdCollections",
  "CreatedCollections",
  "collectionItems",
  "profileCollections",
  "num_owners",
  "vv-latent",
  "vv-rare",
]) {
  console.log(needle, html.includes(needle));
}

// Try opensea gql with auth
const gqlBody = {
  query: `
    query ProfileCreated($address: Address!) {
      profileByAddress(address: $address) {
        address
        createdCollections(first: 100) {
          edges { node { slug name } }
          totalCount
        }
      }
    }
  `,
  variables: { address: addr },
};

for (const url of [
  "https://gql.opensea.io/graphql",
  "https://api.opensea.io/graphql",
  "https://opensea.io/__api/graphql/",
]) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        ...h,
        "content-type": "application/json",
        "x-app-id": "web",
      },
      body: JSON.stringify(gqlBody),
    });
    console.log("gql", url, r.status, (await r.text()).slice(0, 400));
  } catch (e) {
    console.log("gql err", url, e.message);
  }
}

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

// 1) account
const acc = await (
  await fetch(`https://api.opensea.io/api/v2/accounts/${addr}`, { headers: h })
).json();
console.log("account", {
  username: acc.username,
  ens: acc.ens_name,
  display: acc.display_name,
});

// 2) username candidates from ENS
const candidates = ["visualizevalue", "VisualizeValue", "visualize-value"];
for (const u of candidates) {
  let next;
  let n = 0;
  let owned = 0;
  for (let p = 0; p < 5; p++) {
    const url = new URL("https://api.opensea.io/api/v2/collections");
    url.searchParams.set("creator_username", u);
    url.searchParams.set("limit", "50");
    url.searchParams.set("include_hidden", "true");
    if (next) url.searchParams.set("next", next);
    const r = await fetch(url, { headers: h });
    const j = await r.json();
    for (const c of j.collections || []) {
      n++;
      if ((c.owner || "").toLowerCase() === addr) owned++;
    }
    next = j.next;
    if (!next) break;
  }
  console.log("username", u, { total: n, ownedByAddr: owned });
}

// 3) try gql.opensea.io
const gqlTries = [
  "https://gql.opensea.io/graphql",
  "https://api.opensea.io/graphql",
];
const query = `
query {
  __typename
}
`;
for (const url of gqlTries) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...h },
      body: JSON.stringify({ query }),
    });
    console.log("gql", url, r.status, (await r.text()).slice(0, 200));
  } catch (e) {
    console.log("gql fail", url, e.message);
  }
}

// 4) known VV collection check
for (const slug of ["checks-vv-originals", "vv-checks-originals", "vv-full-set", "checks"]) {
  const r = await fetch(`https://api.opensea.io/api/v2/collections/${slug}`, {
    headers: h,
  });
  const t = await r.text();
  console.log("slug", slug, r.status, t.slice(0, 250));
}

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

async function paginate(label, buildUrl) {
  const bySlug = new Map();
  let next;
  let pages = 0;
  let raw = 0;
  for (let p = 0; p < 40; p++) {
    const url = buildUrl(next);
    const r = await fetch(url, { headers: h });
    if (!r.ok) {
      console.log(label, "fail", r.status, (await r.text()).slice(0, 150));
      break;
    }
    const j = await r.json();
    pages++;
    const cols = j.collections || [];
    raw += cols.length;
    for (const c of cols) {
      bySlug.set(c.collection, {
        name: c.name,
        owner: c.owner,
        ownerMatch: (c.owner || "").toLowerCase() === addr,
      });
    }
    next = j.next;
    if (!next || !cols.length) break;
  }
  const matched = [...bySlug.values()].filter((x) => x.ownerMatch).length;
  console.log(label, { pages, raw, unique: bySlug.size, ownerMatch: matched });
  if (bySlug.size <= 80) {
    console.log(
      [...bySlug.entries()]
        .map(
          ([s, v]) =>
            `${s} | ${v.name} | owner=${(v.owner || "").slice(0, 10)} match=${v.ownerMatch}`
        )
        .join("\n")
    );
  } else {
    console.log(
      "sample",
      [...bySlug.entries()]
        .slice(0, 15)
        .map(([s, v]) => s + " match=" + v.ownerMatch)
    );
  }
  return bySlug;
}

await paginate("creator_address", (next) => {
  const u = new URL("https://api.opensea.io/api/v2/collections");
  u.searchParams.set("creator_address", addr);
  u.searchParams.set("limit", "50");
  u.searchParams.set("include_hidden", "true");
  if (next) u.searchParams.set("next", next);
  return u;
});

await paginate("owner_param", (next) => {
  const u = new URL("https://api.opensea.io/api/v2/collections");
  u.searchParams.set("owner", addr);
  u.searchParams.set("limit", "50");
  u.searchParams.set("include_hidden", "true");
  if (next) u.searchParams.set("next", next);
  return u;
});

// ripe0x for comparison
const ripeAcc = await (
  await fetch("https://api.opensea.io/api/v2/accounts/ripe0x.eth", {
    headers: h,
  })
).json();
console.log("\nripe0x account", {
  address: ripeAcc.address,
  username: ripeAcc.username,
  ens: ripeAcc.ens_name,
});
if (ripeAcc.address) {
  await paginate("ripe creator_address", (next) => {
    const u = new URL("https://api.opensea.io/api/v2/collections");
    u.searchParams.set("creator_address", ripeAcc.address);
    u.searchParams.set("limit", "50");
    u.searchParams.set("include_hidden", "true");
    if (next) u.searchParams.set("next", next);
    return u;
  });
  if (ripeAcc.username) {
    await paginate("ripe creator_username", (next) => {
      const u = new URL("https://api.opensea.io/api/v2/collections");
      u.searchParams.set("creator_username", ripeAcc.username);
      u.searchParams.set("limit", "50");
      u.searchParams.set("include_hidden", "true");
      if (next) u.searchParams.set("next", next);
      return u;
    });
  }
}

import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
if (!process.env.OPENSEA_API_KEY && existsSync(".opensea-key.json")) {
  process.env.OPENSEA_API_KEY = JSON.parse(
    readFileSync(".opensea-key.json", "utf8")
  ).api_key;
}

const { discoverOpenSeaCreatedCollections } = await import(
  "../lib/providers/opensea.ts"
);

const vv = await discoverOpenSeaCreatedCollections(
  "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a"
);
console.log("VV", {
  count: vv.collections.length,
  notes: vv.notes,
  names: vv.collections.map((c) => c.name || c.slug),
});

// ripe0x if resolvable
try {
  const acc = await (
    await fetch("https://api.opensea.io/api/v2/accounts/ripe0x.eth", {
      headers: { accept: "application/json" },
    })
  ).json();
  if (acc.address) {
    const ripe = await discoverOpenSeaCreatedCollections(acc.address);
    console.log("ripe0x", {
      address: acc.address,
      count: ripe.collections.length,
      notes: ripe.notes.slice(0, 5),
    });
  } else {
    console.log("ripe0x account resolve", acc);
  }
} catch (e) {
  console.log("ripe skip", e.message);
}

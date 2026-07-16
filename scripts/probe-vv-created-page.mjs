const addrs = [
  "https://opensea.io/0xc8f8e2F59Dd95fF67c3d39109ecA2e2A017D4c8a?tab=created",
  "https://opensea.io/visualizevalue.eth?tab=created",
  "https://opensea.io/visualizevalue?tab=created",
];

for (const u of addrs) {
  const r = await fetch(u, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
      accept: "text/html",
    },
  });
  const t = await r.text();
  console.log("\n===", u, r.status, t.length);
  // next data
  const idx = t.indexOf("__NEXT_DATA__");
  console.log("next_data", idx);
  const m = t.match(/\/_next\/static\/[^"]+/g);
  console.log("static samples", (m || []).slice(0, 3));

  // look for interesting strings
  for (const s of [
    "createdCollections",
    "CreatedCollection",
    "creatorAddress",
    "collectionOwner",
    "profileCollections",
    "tab=created",
    "vv-checks",
    "opepen",
  ]) {
    if (t.includes(s)) console.log("found", s);
  }
}

// try opensea internal API patterns
const keyPaths = [
  "https://opensea.io/api/v2/collections?owner=0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a",
];
for (const u of keyPaths) {
  const r = await fetch(u, {
    headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
  });
  console.log("internal", r.status, (await r.text()).slice(0, 200));
}

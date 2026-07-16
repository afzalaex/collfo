const r = await fetch(
  "https://opensea.io/0xc8f8e2F59Dd95fF67c3d39109ecA2e2A017D4c8a?tab=created",
  {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html",
    },
  }
);
const html = await r.text();

// extract script chunk urls that might contain GraphQL
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
  (m) => m[0]
);
console.log("chunk count", chunks.length);

// search HTML itself around CreatedCollection
let idx = 0;
let hits = 0;
while ((idx = html.indexOf("CreatedCollection", idx)) !== -1 && hits < 5) {
  console.log("--- html context ---");
  console.log(html.slice(Math.max(0, idx - 80), idx + 200));
  idx += 20;
  hits++;
}

// download a few large app chunks and search
const interesting = chunks.filter(
  (c) => c.includes("app") || c.includes("page") || c.length > 40
);
// try all chunk names containing 'profile' or fetch random sample of long ones
const toFetch = chunks.slice(0, 30);
let foundIn = [];
for (const path of chunks) {
  if (
    !/profile|created|collection|account|wallet/i.test(path) &&
    Math.random() > 0.05
  ) {
    // skip most
    continue;
  }
}

// brute: search all script src for CreatedCollection via fetching those that look like app
const candidates = [
  ...new Set(
    chunks.filter((c) =>
      /[a-f0-9]{8,}|app|page|layout|main|profile/i.test(c)
    )
  ),
].slice(0, 40);

for (const path of candidates) {
  try {
    const js = await (
      await fetch("https://opensea.io" + path, {
        headers: { "user-agent": "Mozilla/5.0" },
      })
    ).text();
    if (js.includes("CreatedCollection") || js.includes("createdCollections")) {
      foundIn.push(path);
      console.log("FOUND in", path, "len", js.length);
      // extract nearby graphql strings
      const i = js.indexOf("CreatedCollection");
      console.log(js.slice(Math.max(0, i - 150), i + 400));
    }
  } catch {
    /* */
  }
}
console.log("foundIn", foundIn);

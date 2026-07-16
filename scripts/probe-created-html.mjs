const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";
const url = `https://opensea.io/${addr}/created`;

const r = await fetch(url, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "text/html",
  },
});
const html = await r.text();
console.log("status", r.status, "len", html.length);

// find CreatedCollection contexts
let idx = 0;
let n = 0;
while ((idx = html.indexOf("CreatedCollection", idx)) !== -1 && n < 8) {
  console.log("\n---", n, "---");
  console.log(html.slice(Math.max(0, idx - 100), idx + 300));
  idx += 18;
  n++;
}

// extract all /collection/slug occurrences
const slugs = [
  ...html.matchAll(/\/collection\/([a-zA-Z0-9_-]{2,80})/g),
].map((m) => m[1]);
const unique = [...new Set(slugs)];
console.log("\n/collection/ slugs", unique.length);
console.log(unique.slice(0, 80).join("\n"));

// look for slug patterns near vv-
const vv = unique.filter((s) => /vv|opepen|check|netvv|chrctr|latent|rare|merge|meals|artifact|edition|sovereign|humanity|infinity|cyber|consensus|economy|film|receipt|play|full-set|chrctr/i.test(s));
console.log("\nvv-ish", vv.length, vv);

// Try next-action / RSC flight
const rsc = await fetch(url, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "text/x-component",
    rsc: "1",
    "next-router-state-tree": "[]",
  },
});
console.log("\nrsc", rsc.status, (await rsc.text()).slice(0, 500));

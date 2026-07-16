async function gql(query, variables) {
  const r = await fetch("https://gql.opensea.io/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      origin: "https://opensea.io",
      referer: "https://opensea.io/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
    },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

// resolve ENS-ish known creators with multi-chain work
const addresses = [
  // try afzal if we know, otherwise VV and others
  "0x8ba1f109551bd432803012645ac136ddd64dba72", // random
];

// use created page for a known artist from previous work: visualizevalue
// From memory VV is something - let's resolve via OS HTML or try common
// Actually use address from path of previous session - afzalaex.eth
// Probe via ens reverse? Just query with name.eth-style won't work.
// Fetch OS profile for afzalaex via public page

const r = await fetch("https://opensea.io/afzalaex.eth/created", {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
    accept: "text/html",
  },
});
const html = await r.text();
const m = html.match(/0x[a-fA-F0-9]{40}/);
console.log("status", r.status, "addr sample", m?.[0]);

// Also try GraphQL with ens? addresses need to be 0x
// From HTML extract wallet from og or window data
const addrMatches = [...html.matchAll(/"address":"(0x[a-fA-F0-9]{40})"/gi)].map(
  (x) => x[1].toLowerCase()
);
const uniq = [...new Set(addrMatches)];
console.log("addrs in page", uniq.slice(0, 5));

const artist = uniq[0] || m?.[0];
if (!artist) {
  console.log("no artist address");
  process.exit(1);
}

const fieldAttempts = [
  `slug name imageUrl chain { identifier name } contracts { chain { identifier name } }`,
  `slug name chain { identifier } contracts { chain { identifier } address }`,
  `slug name chain { identifier } contracts { chain { identifier } }`,
  `slug name chain { identifier } address`,
  `slug name chain { identifier } contracts { chain { identifier } id }`,
  `slug name chain { identifier } contracts { chain { identifier } value }`,
  `slug name chain { identifier } contracts { chain { identifier } contractAddress }`,
  `slug name chain { identifier } contracts { chain { identifier } tokenAddress }`,
  `slug name chain { identifier } contracts { chain { identifier } rawAddress }`,
];

for (const fields of fieldAttempts) {
  const j = await gql(
    `query($addresses:[Address!],$limit:Int!,$sort:TopCollectionsSort!){
      userCreatedCollections(addresses:$addresses,limit:$limit,sort:$sort){
        items { ${fields} }
      }
    }`,
    {
      addresses: [artist.toLowerCase()],
      limit: 8,
      sort: { by: "VOLUME", direction: "DESC" },
    }
  );
  if (j.errors) {
    console.log("ERR", j.errors[0].message, "→", fields.slice(0, 80));
  } else {
    console.log("OK", fields.slice(0, 90));
    const items = j.data?.userCreatedCollections?.items ?? [];
    console.log(JSON.stringify(items, null, 2).slice(0, 1500));
  }
}

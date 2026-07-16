/** Verify GraphQL created list returns correct chains for afzalaex.eth */
async function gql(query, variables) {
  const r = await fetch("https://gql.opensea.io/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://opensea.io",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

const artist = "0x237047f8b97ab581974acaec36e6abba793a29b1";
const j = await gql(
  `query($addresses:[Address!],$limit:Int!,$sort:TopCollectionsSort!){
    userCreatedCollections(addresses:$addresses,limit:$limit,sort:$sort){
      items {
        slug name
        address
        chain { identifier }
        contracts { contractAddress chain { identifier } }
      }
    }
  }`,
  {
    addresses: [artist],
    limit: 50,
    sort: { by: "VOLUME", direction: "DESC" },
  }
);

const items = j.data?.userCreatedCollections?.items ?? [];
const byChain = {};
for (const it of items) {
  const ch = it.chain?.identifier ?? "missing";
  byChain[ch] = (byChain[ch] ?? 0) + 1;
}
console.log("total", items.length);
console.log("by chain", byChain);
console.log(
  "sample",
  items.slice(0, 10).map((i) => `${i.slug} → ${i.chain?.identifier}`)
);

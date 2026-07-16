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

const attempts = [
  `items { slug name chain { identifier name } }`,
  `items { slug name chain { identifier } }`,
  `items { slug chain { identifier } }`,
  `items { slug contracts }`,
  `items { slug contracts { chain { identifier } } }`,
  `items { slug contracts { identifier } }`,
  `items { slug contracts { chain } }`,
  `items { slug contracts { address { ... on Address } } }`,
  `items { slug contractAddress }`,
  `items { slug address }`,
  `items { slug contract { address chain { identifier } } }`,
  `items { slug primaryContract { address chain { identifier } } }`,
  `items { slug ownerAddresses }`,
  `items { slug isSafelisted standard }`,
  `items { slug imageUrl chain { identifier name } }`,
];

for (const items of attempts) {
  const j = await gql(
    `query($addresses:[Address!],$limit:Int!,$sort:TopCollectionsSort!){
      userCreatedCollections(addresses:$addresses,limit:$limit,sort:$sort){
        ${items}
      }
    }`,
    {
      addresses: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
      limit: 2,
      sort: { by: "VOLUME", direction: "DESC" },
    }
  );
  const ok = !j.errors;
  console.log(ok ? "OK" : "ERR", items);
  if (ok) console.log(JSON.stringify(j.data, null, 2).slice(0, 800));
  else console.log(" ", j.errors?.[0]?.message);
}

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

const fieldSets = [
  `slug name chain`,
  `slug name chainIdentifier`,
  `slug name nativeChain`,
  `slug name contracts { address chain }`,
  `slug name nativeContracts { address chain }`,
  `slug name connectedAddresses { address chain }`,
  `slug name defaultChain`,
  `slug name chain { identifier name }`,
  `slug name isVerified standard`,
];

for (const fields of fieldSets) {
  const query = `query { collectionBySlug(slug: "boredapeyachtclub") { ${fields} } }`;
  const j = await gql(query);
  console.log("\n===", fields);
  console.log(JSON.stringify(j, null, 0).slice(0, 600));
}

// Also try userCreatedCollections items with contracts
const created = await gql(
  `query($addresses:[Address!],$limit:Int!,$sort:TopCollectionsSort!){
    userCreatedCollections(addresses:$addresses,limit:$limit,sort:$sort){
      items {
        slug
        name
        contracts { address chain }
        chain
        nativeChain
      }
      nextPageCursor
    }
  }`,
  {
    addresses: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045".toLowerCase()],
    limit: 3,
    sort: { by: "VOLUME", direction: "DESC" },
  }
);
console.log("\n=== userCreated with contracts");
console.log(JSON.stringify(created, null, 2).slice(0, 2000));

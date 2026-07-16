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

// Introspect Collection, Chain, ContractIdentifier
for (const name of ["Collection", "Chain", "ContractIdentifier", "Contract"]) {
  const j = await gql(`{ __type(name: "${name}") { name fields { name type { name kind ofType { name kind ofType { name } } } } } }`);
  console.log("\n=== type", name);
  const fields = j.data?.__type?.fields ?? [];
  for (const f of fields) {
    const t = f.type;
    const label =
      t.name ||
      (t.ofType && (t.ofType.name || t.ofType.ofType?.name)) ||
      t.kind;
    console.log(" ", f.name, "→", t.kind, label);
  }
  if (j.errors) console.log(JSON.stringify(j.errors).slice(0, 300));
}

const created = await gql(
  `query($addresses:[Address!],$limit:Int!,$sort:TopCollectionsSort!){
    userCreatedCollections(addresses:$addresses,limit:$limit,sort:$sort){
      items {
        slug
        name
        chain { identifier name }
        contracts { address chain { identifier } }
      }
    }
  }`,
  {
    // Afzal or a known multi-chain artist - use vitalik as fallback
    addresses: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
    limit: 5,
    sort: { by: "VOLUME", direction: "DESC" },
  }
);
console.log("\n=== created sample");
console.log(JSON.stringify(created, null, 2).slice(0, 3000));

const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";
const sorts = [
  { by: "VOLUME", direction: "DESC" },
  { by: "SCORE", direction: "DESC" },
  { by: "SEVEN_DAY_VOLUME", direction: "DESC" },
  { by: "ONE_DAY_VOLUME", direction: "DESC" },
  { by: "THIRTY_DAY_VOLUME", direction: "DESC" },
  { by: "TOTAL_VOLUME", direction: "DESC" },
  { by: "ALL_TIME_VOLUME", direction: "DESC" },
  { by: "FLOOR_PRICE", direction: "DESC" },
  { by: "CREATED_DATE", direction: "DESC" },
  { by: "NAME", direction: "ASC" },
  { by: "NUM_OWNERS", direction: "DESC" },
  { by: "NUM_ITEMS", direction: "DESC" },
  { by: "MARKET_CAP", direction: "DESC" },
];

const query = `
  query($addresses: [Address!], $limit: Int!, $sort: TopCollectionsSort!) {
    userCreatedCollections(addresses: $addresses, limit: $limit, sort: $sort) {
      items { slug name imageUrl id }
      nextPageCursor
    }
  }
`;

for (const sort of sorts) {
  const r = await fetch("https://gql.opensea.io/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      origin: "https://opensea.io",
      referer: `https://opensea.io/${addr}/created`,
    },
    body: JSON.stringify({
      query,
      variables: { addresses: [addr], limit: 100, sort },
    }),
  });
  const j = await r.json();
  if (j.errors) {
    console.log(JSON.stringify(sort), "ERR", j.errors[0].message);
  } else {
    const items = j.data?.userCreatedCollections?.items || [];
    console.log(
      JSON.stringify(sort),
      "OK",
      items.length,
      "next",
      j.data?.userCreatedCollections?.nextPageCursor
    );
    if (items.length) {
      console.log("  sample", items.slice(0, 5).map((i) => i.slug).join(", "));
    }
  }
}

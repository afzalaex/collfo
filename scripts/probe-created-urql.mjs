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

const marker = "userCreatedCollections";
const i = html.indexOf(marker);
console.log("marker index", i);
if (i < 0) process.exit(1);

// Extract a large window of the urql rehydrate payload
const window = html.slice(i, i + 200000);

// Find all slug fields in this region
const slugs = [...window.matchAll(/"slug":"([a-zA-Z0-9_-]+)"/g)].map(
  (m) => m[1]
);
const unique = [...new Set(slugs)];
console.log("slugs in window", unique.length);
console.log(unique.join("\n"));

// Try to find totalCount
const tc = window.match(/"totalCount":(\d+)/);
console.log("totalCount", tc?.[1]);

// Find end of items array roughly
const itemsIdx = window.indexOf('"items":[');
console.log("items idx", itemsIdx);

// Attempt to call the same GraphQL op that OpenSea uses
// Search for operation name near userCreatedCollections
const before = html.slice(Math.max(0, i - 500), i + 200);
console.log("\nbefore context\n", before);

// Look for persisted query hash or operation
const opMatch = html.match(/userCreatedCollections[^]{0,200}/);
console.log("op match", opMatch?.[0]?.slice(0, 200));

// Try graphql with userCreatedCollections
const queries = [
  `query { __type(name: "Query") { fields { name } } }`,
  `query { __schema { queryType { fields { name } } } }`,
];

for (const query of queries) {
  const gr = await fetch("https://gql.opensea.io/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
      accept: "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await gr.text();
  console.log("\nschema", gr.status, text.slice(0, 3000));
  if (text.includes("userCreated") || text.includes("Created")) {
    const names = [...text.matchAll(/"name":"([^"]*[Cc]reat[^"]*)"/g)].map(
      (m) => m[1]
    );
    console.log("create fields", names);
  }
}

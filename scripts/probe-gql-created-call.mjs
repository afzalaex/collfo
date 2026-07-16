const addr = "0xc8f8e2f59dd95ff67c3d39109eca2e2a017d4c8a";

const queries = [
  {
    name: "addresses only",
    query: `
      query($addresses: [Address!], $limit: Int!) {
        userCreatedCollections(addresses: $addresses, limit: $limit, sort: { by: SEVEN_DAY_VOLUME, direction: DESC }) {
          items { id slug name imageUrl }
          nextPageCursor
        }
      }
    `,
    variables: { addresses: [addr], limit: 100 },
  },
  {
    name: "sort ALL_TIME",
    query: `
      query($addresses: [Address!], $limit: Int!) {
        userCreatedCollections(
          addresses: $addresses
          limit: $limit
          sort: { by: ALL_TIME_VOLUME, direction: DESC }
        ) {
          items { id slug name imageUrl }
          nextPageCursor
        }
      }
    `,
    variables: { addresses: [addr], limit: 100 },
  },
  {
    name: "minimal sort enum string",
    query: `
      query {
        userCreatedCollections(
          addresses: ["${addr}"]
          limit: 100
          sort: SEVEN_DAY_VOLUME
        ) {
          items { slug name }
          nextPageCursor
        }
      }
    `,
    variables: {},
  },
];

for (const q of queries) {
  for (const url of [
    "https://gql.opensea.io/graphql",
    "https://opensea.io/__api/graphql/",
  ]) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
        origin: "https://opensea.io",
        referer: `https://opensea.io/${addr}/created`,
        "x-app-id": "os2-web",
      },
      body: JSON.stringify({ query: q.query, variables: q.variables }),
    });
    const t = await r.text();
    console.log("\n", q.name, url, r.status);
    console.log(t.slice(0, 600));
  }
}

// Fallback: parse HTML rehydrate — already proven 39
const html = await (
  await fetch(`https://opensea.io/${addr}/created`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
    },
  })
).text();

function parseCreatedFromHtml(html) {
  const marker = '"userCreatedCollections":';
  const i = html.indexOf(marker);
  if (i < 0) return [];
  // find items array start
  const itemsKey = '"items":[';
  const j = html.indexOf(itemsKey, i);
  if (j < 0) return [];
  let start = j + itemsKey.length - 1; // at [
  // bracket match
  let depth = 0;
  let end = -1;
  for (let k = start; k < Math.min(html.length, start + 800000); k++) {
    const ch = html[k];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = k + 1;
        break;
      }
    }
  }
  if (end < 0) return [];
  const json = html.slice(start, end);
  try {
    const items = JSON.parse(json);
    return items.map((it) => ({
      slug: it.slug,
      name: it.name ?? null,
      imageUrl: it.imageUrl ?? null,
      id: it.id ?? null,
    }));
  } catch (e) {
    console.log("parse fail", e.message, json.slice(0, 200));
    return [];
  }
}

const parsed = parseCreatedFromHtml(html);
console.log("\nHTML parse count", parsed.length);
console.log(parsed.map((p) => p.slug + " — " + p.name).join("\n"));

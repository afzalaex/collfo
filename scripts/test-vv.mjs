import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// load env
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
if (!process.env.OPENSEA_API_KEY && existsSync(".opensea-key.json")) {
  process.env.OPENSEA_API_KEY = JSON.parse(
    readFileSync(".opensea-key.json", "utf8")
  ).api_key;
}

// dynamic import via tsx isn't available - call discovery only via pure logic
const { discoverOpenSeaCreatedCollections } = await import(
  "../lib/providers/opensea.ts"
).catch(async () => {
  // fallback: inline fetch test
  return { discoverOpenSeaCreatedCollections: null };
});

if (discoverOpenSeaCreatedCollections) {
  const r = await discoverOpenSeaCreatedCollections(
    "0xc8f8e2F59Dd95fF67c3d39109ecA2e2A017D4c8a",
    { maxListPages: 40 }
  );
  console.log({
    count: r.collections.length,
    username: r.username,
    error: r.error,
    notes: r.notes,
    names: r.collections.map((c) => c.name),
  });
} else {
  console.log("import failed");
}

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://api.opensea.io/api/v2";

type StoredKey = {
  api_key: string;
  expires_at: string;
  source: "env" | "instant";
};

/** Survives dev-server restarts so we don't burn the 1-key/hour quota. */
function keyFilePath(): string {
  return join(process.cwd(), ".opensea-key.json");
}

let memory: StoredKey | null = null;
let mintPromise: Promise<string> | null = null;

function stillFresh(stored: StoredKey): boolean {
  const exp = Date.parse(stored.expires_at);
  if (!Number.isFinite(exp)) return true;
  // treat as expired 1 day early
  return exp > Date.now() + 24 * 60 * 60 * 1000;
}

function readDisk(): StoredKey | null {
  try {
    const p = keyFilePath();
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<StoredKey>;
    if (!raw.api_key) return null;
    return {
      api_key: raw.api_key,
      expires_at: raw.expires_at ?? new Date(Date.now() + 30 * 864e5).toISOString(),
      source: raw.source === "env" ? "env" : "instant",
    };
  } catch {
    return null;
  }
}

function writeDisk(stored: StoredKey): void {
  try {
    writeFileSync(keyFilePath(), JSON.stringify(stored, null, 2), "utf8");
  } catch {
    // ignore read-only FS
  }
}

/**
 * 1. OPENSEA_API_KEY env
 * 2. .opensea-key.json (reuse across restarts)
 * 3. Mint instant key once, save to disk
 * 4. On 429: reuse stale disk key if any
 */
export async function resolveOpenSeaApiKey(): Promise<string> {
  const envKey = process.env.OPENSEA_API_KEY?.trim();
  if (envKey) return envKey;

  if (memory && stillFresh(memory)) return memory.api_key;

  const disk = readDisk();
  if (disk && stillFresh(disk)) {
    memory = disk;
    return disk.api_key;
  }

  if (!mintPromise) {
    mintPromise = mintAndStore().finally(() => {
      mintPromise = null;
    });
  }

  try {
    return await mintPromise;
  } catch (err) {
    // Rate-limited: keep using last key even if near expiry
    if (disk?.api_key) {
      memory = disk;
      return disk.api_key;
    }
    if (memory?.api_key) return memory.api_key;
    throw err;
  }
}

async function mintAndStore(): Promise<string> {
  const res = await fetch(`${BASE}/auth/keys`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });

  const text = await res.text();

  if (res.status === 429) {
    throw new Error(
      [
        "OpenSea free key quota: max ~1 new key per hour per IP.",
        "Wait ~60 minutes, restart once — key is then saved to .opensea-key.json and reused.",
        "Do not spam refresh while waiting.",
      ].join(" ")
    );
  }

  if (!res.ok) {
    throw new Error(`OpenSea key mint failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = JSON.parse(text) as { api_key?: string; expires_at?: string };
  if (!json.api_key) {
    throw new Error("OpenSea key mint response missing api_key");
  }

  const stored: StoredKey = {
    api_key: json.api_key,
    expires_at:
      json.expires_at ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    source: "instant",
  };

  memory = stored;
  writeDisk(stored);
  return stored.api_key;
}

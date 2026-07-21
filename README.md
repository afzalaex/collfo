# Collfo

**Every collector of an artist** — all collections OpenSea attributes to them, plus any manually added custom contracts, distilled into one merged, deduplicated holder list.

---

## How it works

Collfo uses a hybrid approach to find every piece of art an artist has created and then compiles a definitive list of their unique collectors.

### 1. OpenSea Discovery (The default path)

```text
artist wallet or ENS
  → GET /api/v2/accounts/{address}           → username
  → GET /api/v2/collections?creator_username=…
  → for each collection slug:
        GET /api/v2/collections/{slug}/holders
```

This leverages OpenSea's **created-by** index rather than relying purely on on-chain "who deployed the bytecode." Platform mints (Zora, Manifold, SeaDrop, Studio, shared factories) correctly show up here because OpenSea tracks the *creator/artist*, not just the EOA deployer.

### 2. Custom Contracts (The Etherscan/Reservoir path)

Artists often have sovereign smart contracts or platform drops that OpenSea hasn't indexed perfectly. Users can manually paste these contract addresses (or non-standard collection URLs) directly into Collfo to catch any missed collections.

```text
user inputs contract address
  → Validate via EVM.now / network RPCs for basic metadata
  → Fetch token holders via block explorers (like Etherscan) parsing Transfer logs
  → Extract unique token holders and merge them into the global collector pool
```

### 3. Contract Verification & Reading (EVM.now)

To keep the UI clean and chain-agnostic, Collfo links custom contracts directly to [EVM.now](https://evm.now). This acts as a universal, streamlined contract reader and block explorer, making it easy to read contract details across different EVM chains without jumping between Etherscan, Basescan, or Optimistic Etherscan.

### 4. Merging & Ranking Collectors

Once all collections (OpenSea native + manually added contracts) are loaded, Collfo streams all holders in the background. It applies the following logic:
- **Filters out the creator:** The searched artist's wallets are subtracted from the holders list so they don't pad the stats.
- **Deduplication:** A single wallet holding tokens across 5 different collections is counted as just *one* Unique Collector.
- **Ranking:** Collectors are ranked by the *number of distinct collections* they hold, revealing the artist's most loyal supporters.

---

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 15 + React 19 + TypeScript |
| Host | Vercel |
| Data | OpenSea API + Reservoir / Etherscan + EVM.now |

---

## Setup

```bash
cd Collfo
npm install
npm run dev
```

**No developer approval required for local/dev.**  
If `OPENSEA_API_KEY` is unset, the server calls OpenSea’s **instant free key**:

```bash
curl -X POST https://api.opensea.io/api/v2/auth/keys
```

(~30 day expiry, lower rate limits.)

### If Settings → Developer says "not approved"

That’s the **full** developer hub. Skip it for now — use the instant key above (auto) or paste the `api_key` into `.env.local` as `OPENSEA_API_KEY`.

For a longer-term key after approval:

1. Verify a real email on [opensea.io](https://opensea.io) (not anonymous)
2. Settings → Developer → Get access → describe Collfo
3. Create key → `OPENSEA_API_KEY` in env / Vercel

Deploy: `npx vercel` — either rely on instant keys or set `OPENSEA_API_KEY`.

---

## Repo map

```text
lib/providers/opensea.ts   # account, created collections, holders
lib/providers/etherscan.ts # custom contract data retrieval
lib/collectors.ts          # merge + rank logic
app/artist/[address]       # UI pages
app/api/artist/[address]   # JSON API routes
```

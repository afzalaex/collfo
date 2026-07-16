# Collectorfo

**Every collector of an artist** — all collections OpenSea attributes to them, one merged holder list.

Branding matches [aex-site](../aex-site).

---

## How it works (OpenSea technique)

```
artist wallet
  → GET /api/v2/accounts/{address}           → username
  → GET /api/v2/collections?creator_username=…
  → for each collection slug:
        GET /api/v2/collections/{slug}/holders
  → merge wallets ranked by # of that artist’s collections held
```

This is the same **created-by** index as OpenSea’s profile, not on-chain “who deployed the bytecode.” Platform mints (Zora, Manifold, SeaDrop, Studio, shared factories) show up because OpenSea tracks **creator**, not EOA deployer.

---

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 15 + React 19 + TypeScript |
| Host | Vercel |
| Data | **OpenSea API only** |

---

## Setup

```bash
cd Collectorfo
npm install
npm run dev
```

**No developer approval required for local/dev.**  
If `OPENSEA_API_KEY` is unset, the server calls OpenSea’s **instant free key**:

```bash
curl -X POST https://api.opensea.io/api/v2/auth/keys
```

(~30 day expiry, lower rate limits.)

### If Settings → Developer says “not approved”

That’s the **full** developer hub. Skip it for now — use the instant key above (auto) or paste the `api_key` into `.env.local` as `OPENSEA_API_KEY`.

For a longer-term key after approval:

1. Verify a real email on [opensea.io](https://opensea.io) (not anonymous)
2. Settings → Developer → Get access → describe Collectorfo
3. Create key → `OPENSEA_API_KEY` in env / Vercel

Deploy: `npx vercel` — either rely on instant keys or set `OPENSEA_API_KEY`.

---

## Repo map

```
lib/providers/opensea.ts   # account, created collections, holders
lib/collectors.ts          # merge + rank
app/artist/[address]       # UI
app/api/artist/[address]   # JSON API
```

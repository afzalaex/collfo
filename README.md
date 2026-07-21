# Collfo

### What it is and what it does

Collfo is a tool built for artists minting on Ethereum and its Layer 2 networks. It finds every collector of an artist by gathering all collections OpenSea attributes to them, plus any manually added custom smart contracts. It then distills everything into one merged, deduplicated list of unique token holders. It allows you to see who truly holds your work across every collection you have ever created.

### How it works and what logic we are using

Collfo uses a hybrid approach to find every piece of art an artist has created to compile a definitive list of unique collectors. If you are forking this project, understanding this two pronged logic is critical:

1. **OpenSea Discovery (The Primary Engine)**: When a user enters a wallet address, ENS name, or OpenSea username, the app queries the OpenSea API to find the associated username. It then fetches all collections created by that user. This leverages the OpenSea creator index, meaning platform mints like Zora, Manifold, or SeaDrop correctly show up. The app then fetches the holders for each of these collections. 

2. **Custom Contracts (The Fallback Engine)**: Artists often have sovereign smart contracts or platform drops that OpenSea has not indexed perfectly. Users can manually paste these contract addresses directly into Collfo. When a custom contract address is entered, the app bypasses OpenSea entirely. Instead, it connects to block explorers like Etherscan to parse historical Transfer logs. It extracts unique token holders from these logs and merges them straight into the global collector pool.

3. **Merging and Ranking**: Once all collections are loaded, Collfo streams all holders in the background. It filters out the creator wallets so they do not pad the statistics. A single wallet holding tokens across multiple collections is counted as just one Unique Collector. Collectors are then ranked by the number of distinct collections they hold.

### How to build and use OpenSea and Etherscan API keys

If you are forking Collfo, follow this step by step guide to get your local environment running.

**Step 1: Clone and Install**
```bash
git clone https://github.com/afzalaex/collfo.git
cd collfo
npm install
```

**Step 2: Environment Variables**
For the app to fetch data correctly, you must set up your API keys in a `.env.local` file in the root directory.

* **OpenSea API Key**: You need an OpenSea API key to fetch collections and standard holders. If you do not have one, you can generate an instant free key by running a POST request to the OpenSea API auth endpoint:
  `curl -X POST https://api.opensea.io/api/v2/auth/keys`
  For a permanent key, verify your email on OpenSea, go to Developer Settings, and request access. Add this key to your `.env.local` file as `OPENSEA_API_KEY`.

* **Etherscan API Key**: This is absolutely required to fetch data for custom contracts. You must generate an API key from your Etherscan developer dashboard and add it to your `.env.local` file as `ETHERSCAN_API_KEY`. If this is missing, the app will fail to process custom contract addresses locally.

* **Alchemy API Key (Optional)**: If you are doing deep EVM metadata fetching, you can add `ALCHEMY_API_KEY`.

Your `.env.local` should look like this:
```text
OPENSEA_API_KEY=your_opensea_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
```

**Step 3: Run the Development Server**
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### EVM.now is the contract viewer

To keep the UI clean and chain agnostic, Collfo links custom contracts directly to [EVM.now](https://evm.now). EVM.now acts as a universal, streamlined contract reader and block explorer. It makes it extremely easy to read contract details across different EVM chains without jumping between different network explorers like Etherscan, Basescan, or Optimistic Etherscan. If you want to modify how outbound contract links are handled, look at the UI routing components.

### Stack

This project is built for speed and seamless background data fetching.
| Layer | Choice | Why we chose it |
|--------|--------|-----------------|
| App | Next.js 15 + React 19 + TypeScript | Allows Server Components to securely handle API keys while Client Components stream data. |
| Host | Vercel | Seamless deployment with built in Analytics and edge caching. |
| Data | OpenSea API + Etherscan + EVM.now | Provides the most comprehensive coverage of both indexed platform mints and raw unindexed smart contracts. |

### Repo Map

If you want to contribute or modify the codebase, here is where everything lives:

```text
/lib/providers/opensea.ts   # Handles all communication with OpenSea (accounts, collections, holders)
/lib/providers/etherscan.ts # Handles raw RPC and Etherscan log parsing for custom contracts
/lib/collectors.ts          # The core brain that merges OpenSea and Etherscan data and ranks the holders
/app/artist/[address]       # The frontend UI pages where the Progressive Loading UI lives
/app/api/artist/[address]   # The Next.js API routes that securely fetch data using your env keys
```

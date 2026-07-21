# Collfo

### What it is and what it does

Collfo is a tool built for artists minting on Ethereum and its Layer 2 networks. It finds every collector of an artist by gathering all collections OpenSea attributes to them, plus any manually added custom smart contracts. It then distills everything into one merged, deduplicated list of unique token holders. It allows you to see who truly holds your work across every collection you have ever created.

### How it works and what logic we are using

Collfo uses a hybrid approach to find every piece of art an artist has created to compile a definitive list of unique collectors.

1. OpenSea Discovery: When a user enters a wallet address, ENS name, or OpenSea username, the app queries the OpenSea API to find the associated username. It then fetches all collections created by that user. This leverages the OpenSea creator index, meaning platform mints like Zora, Manifold, or SeaDrop correctly show up. The app then fetches the holders for each of these collections.

2. Custom Contracts: Artists often have sovereign smart contracts or platform drops that OpenSea has not indexed perfectly. Users can manually paste these contract addresses directly into Collfo. When a custom contract address is entered, the app bypasses OpenSea entirely. Instead, it connects to block explorers like Etherscan to parse historical Transfer logs. It extracts unique token holders from these logs and merges them straight into the global collector pool.

3. Merging and Ranking: Once all collections are loaded, Collfo streams all holders in the background. It filters out the creator wallets so they do not pad the statistics. A single wallet holding tokens across multiple collections is counted as just one Unique Collector. Collectors are then ranked by the number of distinct collections they hold.

### How to build and use OpenSea and Etherscan API keys

To build and run the project locally, run the following commands:

* npm install
* npm run dev

For the app to fetch data correctly, you must set up your environment variables in a .env.local file.

1. OpenSea API Key: You need an OpenSea API key to fetch collections and standard holders. If you do not have one, you can generate an instant free key by running a POST request to the OpenSea API auth endpoint. For a permanent key, verify your email on OpenSea, go to Developer Settings, and request access. Add this key to your .env.local file as OPENSEA_API_KEY.

2. Etherscan API Key: This is absolutely required to fetch data for custom contracts. You must generate an API key from your Etherscan developer dashboard and add it to your .env.local file as ETHERSCAN_API_KEY. If this is missing, the app will fail to process custom contract addresses locally.

### EVM.now is the contract viewer

To keep the UI clean and chain agnostic, Collfo links custom contracts directly to EVM.now. EVM.now acts as a universal, streamlined contract reader and block explorer. It makes it extremely easy to read contract details across different EVM chains without jumping between different network explorers like Etherscan, Basescan, or Optimistic Etherscan.

import { createPublicClient, http, parseAbi, isAddress } from "viem";
import { mainnet } from "viem/chains";

export async function getEtherscanCollectionHolders(
  address: string,
  options?: { maxPages?: number; cursor?: string | null }
) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error("ETHERSCAN_API_KEY is missing");
  }

  // We are going to fetch logs for this address.
  // Using the V2 API: module=logs&action=getLogs
  const page = options?.cursor ? parseInt(options.cursor, 10) : 1;
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest&page=${page}&offset=1000&apikey=${key}`;

  const res = await fetch(url);
  const data = await res.json();
  console.log("Etherscan API response:", data.status, data.message, data.result?.length);

  if (data.status === "0" && data.message === "No records found") {
    return {
      holders: [],
      hasMore: false,
      nextCursor: null,
      pagesFetched: 1,
    };
  }

  if (data.status !== "1" || !Array.isArray(data.result)) {
    if (typeof data.result === "string" && data.result.includes("limit")) {
      throw new Error("429: " + data.result);
    }
    throw new Error(data.result || "Failed to fetch logs from Etherscan");
  }

  const logs = data.result;
  const addresses = new Set<string>();
  const ERC721_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const ERC1155_SINGLE = "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
  const ERC1155_BATCH = "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";
  const AAA_CREATED = "0x822b3073be62c5c7f143c2dcd71ee266434ee935d90a1eec3be34710ac8ec1a2";

  const balances: Record<string, number> = {};
  const childContracts = new Set<string>();

  const addBal = (addr: string, val: number) => {
    if (addr !== "0x0000000000000000000000000000000000000000" && isAddress(addr)) {
      balances[addr] = (balances[addr] || 0) + val;
    }
  };

  const parseAddr = (topic: any) => {
    if (typeof topic === "string" && topic.length === 66) {
      return "0x" + topic.slice(26).toLowerCase();
    }
    return null;
  };

  for (const log of logs) {
    if (!log.topics || !Array.isArray(log.topics) || log.topics.length === 0) continue;
    const sig = log.topics[0];

    if (sig === ERC721_TRANSFER && log.topics.length >= 3) {
      const from = parseAddr(log.topics[1]);
      const to = parseAddr(log.topics[2]);
      if (from) addBal(from, -1);
      if (to) addBal(to, 1);
    } else if ((sig === ERC1155_SINGLE || sig === ERC1155_BATCH) && log.topics.length >= 4) {
      // For ERC1155, operator is topic 1, from is topic 2, to is topic 3
      const from = parseAddr(log.topics[2]);
      const to = parseAddr(log.topics[3]);
      // value is usually in data, but we just count +1/-1 for holders (simplified)
      if (from) addBal(from, -1);
      if (to) addBal(to, 1);
    } else if (sig === AAA_CREATED && log.topics.length >= 3) {
      // Factory contract event: Created(address indexed artpiece, address indexed minter, uint256 seed)
      const childContract = parseAddr(log.topics[1]);
      if (childContract) childContracts.add(childContract);
    } else if (log.topics.length >= 3) {
      // Fallback for custom events (usually the new owner/minter is topic[2])
      const to = parseAddr(log.topics[2]);
      if (to) addBal(to, 1);
    }
  }

  for (const [addr, bal] of Object.entries(balances)) {
    if (bal > 0) addresses.add(addr);
  }

  // If there are factory child contracts, query their current owners via multicall
  if (childContracts.size > 0) {
    console.log(`Executing multicall for ${childContracts.size} child contracts...`);
    const client = createPublicClient({
      chain: mainnet,
      transport: http("https://ethereum-rpc.publicnode.com"),
    });

    const abi = parseAbi(["function owner() view returns (address)"]);
    const contracts = Array.from(childContracts).map((c) => ({
      address: c as `0x${string}`,
      abi,
      functionName: "owner",
    }));

    // Multicall all the child contracts
    try {
      const results = await client.multicall({ contracts });
      console.log(`Multicall completed. Results count: ${results.length}`);
      let successCount = 0;
      for (const res of results) {
        if (res.status === "success" && res.result) {
          successCount++;
          const owner = (res.result as string).toLowerCase();
          if (owner !== "0x0000000000000000000000000000000000000000") {
            addresses.add(owner);
          }
        }
      }
    } catch (err) {
      console.warn("Failed multicall for child contracts:", err);
    }
  }

  const holders = Array.from(addresses).map((addr) => ({
    address: addr,
    quantity: 1, // We don't know the exact balance, assume 1
  }));

  const hasMore = logs.length === 1000;
  const maxPages = options?.maxPages ?? 10;
  const nextCursor = hasMore && page < maxPages ? String(page + 1) : null;

  return {
    holders,
    hasMore: Boolean(nextCursor),
    nextCursor,
    pagesFetched: 1,
  };
}

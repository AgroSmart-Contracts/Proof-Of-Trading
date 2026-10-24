import { createPublicClient, http, parseAbi } from "viem";
import { optionalEnv } from "./env.js";

const ABI = parseAbi([
  "function completed(uint256) view returns (bool)",
  "function vault(uint256) view returns (address)",
  "function maxDeposit(uint256) view returns (uint256)",
  "function borrower(uint256) view returns (address)",
]);

export type ArcDeal = {
  stub: boolean;
  chain_id: number;
  deals_manager: string;
  nft_id: string;
  completed?: boolean;
  vault?: string;
  maxDeposit?: string;
  borrower?: string;
};

export const arcChainId = () => Number(optionalEnv("ARC_CHAIN_ID") ?? 5042002);
export const arcDealsManager = () =>
  optionalEnv("ARC_DEALS_MANAGER") ?? "0xfA3D35C236CFe644786e9B360706eB97CF2836A7";

/** Read-only DealsManager lookup on Arc testnet. Returns a labelled stub when ARC_RPC_URL is unset or the id is a stub. */
export async function readDeal(nftId: string): Promise<ArcDeal> {
  const base = { chain_id: arcChainId(), deals_manager: arcDealsManager(), nft_id: nftId };
  const url = optionalEnv("ARC_RPC_URL");
  if (!url || nftId.startsWith("stub-")) {
    if (!url) console.warn(`[arc] ARC_RPC_URL not set; using STUB deal data for nft ${nftId}`);
    return { ...base, stub: true };
  }
  const client = createPublicClient({ transport: http(url) });
  const address = base.deals_manager as `0x${string}`;
  const id = BigInt(nftId);
  const [completed, vault, maxDeposit, borrower] = await Promise.all([
    client.readContract({ address, abi: ABI, functionName: "completed", args: [id] }),
    client.readContract({ address, abi: ABI, functionName: "vault", args: [id] }),
    client.readContract({ address, abi: ABI, functionName: "maxDeposit", args: [id] }),
    client.readContract({ address, abi: ABI, functionName: "borrower", args: [id] }),
  ]);
  return { ...base, stub: false, completed, vault, maxDeposit: maxDeposit.toString(), borrower };
}

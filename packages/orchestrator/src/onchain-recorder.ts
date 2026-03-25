/**
 * onchain-recorder.ts
 * Records AI signals to the SignalRegistry contract on X Layer Testnet.
 * When COORDINATOR_KEY + SIGNAL_REGISTRY_ADDRESS are set, recording is REAL.
 * Otherwise returns a simulation receipt.
 */
import { ethers } from "ethers";

const XLAYER_TESTNET_RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY;
const REGISTRY_ADDRESS = process.env.SIGNAL_REGISTRY_ADDRESS;

const REGISTRY_ABI = [
  "function recordSignal(string pair, string verdict, uint8 confidence, string riskLevel, bool riskApproved) returns (uint256)",
  "event SignalRecorded(address indexed user, string pair, string verdict, uint8 confidence, uint256 indexed signalId)",
];

export interface OnchainRecordResult {
  txHash: string;
  explorerUrl: string;
  real: boolean;
}

export async function recordSignalOnchain(
  pair: string,
  verdict: string,
  confidence: number, // 0-100
  riskLevel: string,
  riskApproved: boolean
): Promise<OnchainRecordResult> {
  // --- Real onchain path ---
  if (COORDINATOR_KEY && REGISTRY_ADDRESS) {
    try {
      const provider = new ethers.JsonRpcProvider(XLAYER_TESTNET_RPC);
      const wallet = new ethers.Wallet(COORDINATOR_KEY, provider);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

      const tx = await (registry.recordSignal as (
        pair: string, verdict: string, confidence: number,
        riskLevel: string, riskApproved: boolean
      ) => Promise<ethers.TransactionResponse>)(pair, verdict, Math.round(confidence), riskLevel, riskApproved);

      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;
      const explorerUrl = `https://www.oklink.com/xlayer-test/tx/${hash}`;

      console.log(`✅ [Onchain] Signal recorded: ${pair} ${verdict} @ ${Math.round(confidence)}%`);
      console.log(`   TX: ${explorerUrl}`);

      return { txHash: hash, explorerUrl, real: true };
    } catch (err) {
      console.warn(`⚠️  [Onchain] Recording failed, using simulation:`, err);
    }
  }

  // --- Simulation fallback ---
  const fakeTx = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")}`;
  const explorerUrl = `https://www.oklink.com/xlayer-test/tx/${fakeTx}`;
  console.log(`🔵 [Onchain] Simulated record: ${pair} ${verdict}`);
  return { txHash: fakeTx, explorerUrl, real: false };
}

/** Fetch signal history for a wallet address from the registry */
export async function getSignalHistory(userAddress: string): Promise<Array<{
  id: number;
  pair: string;
  verdict: string;
  confidence: number;
  riskLevel: string;
  riskApproved: boolean;
  timestamp: number;
  txHash: string;
  explorerUrl: string;
}>> {
  if (!REGISTRY_ADDRESS) return [];

  try {
    const provider = new ethers.JsonRpcProvider(XLAYER_TESTNET_RPC);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, [
      ...REGISTRY_ABI,
      "function getUserSignals(address user) view returns (uint256[])",
      "function getSignal(uint256 id) view returns (tuple(address user, string pair, string verdict, uint8 confidence, string riskLevel, bool riskApproved, uint256 timestamp))",
    ], provider);

    const ids: bigint[] = await (registry.getUserSignals as (addr: string) => Promise<bigint[]>)(userAddress);

    const signals = await Promise.all(ids.map(async (id) => {
      const s = await (registry.getSignal as (id: bigint) => Promise<{
        pair: string; verdict: string; confidence: bigint;
        riskLevel: string; riskApproved: boolean; timestamp: bigint;
      }>)(id);
      return {
        id: Number(id),
        pair: s.pair,
        verdict: s.verdict,
        confidence: Number(s.confidence),
        riskLevel: s.riskLevel,
        riskApproved: s.riskApproved,
        timestamp: Number(s.timestamp) * 1000,
        txHash: "",
        explorerUrl: `https://www.oklink.com/xlayer-test/address/${REGISTRY_ADDRESS}`,
      };
    }));

    return signals.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn("[History] Failed to fetch from chain:", err);
    return [];
  }
}

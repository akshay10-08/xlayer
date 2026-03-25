/**
 * x402-client.ts
 * Real USDC micro-payments on X Layer Testnet between AI agents.
 * When COORDINATOR_KEY + XLAYER_USDC_ADDRESS are set, payments are REAL.
 * When keys are absent, falls back to simulation (returns fake receipt id).
 */
import { ethers } from "ethers";

const XLAYER_TESTNET_RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY;
const USDC_ADDRESS = process.env.XLAYER_USDC_ADDRESS;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

export interface PaymentResult {
  txHash: string;
  amountUsd: number;
  agentWallet: string;
  real: boolean;
}

export async function payAgent(
  agentWallet: string,
  amountUSDC: number,
  agentId: string
): Promise<PaymentResult> {
  // --- Real payment path ---
  if (COORDINATOR_KEY && USDC_ADDRESS) {
    try {
      const provider = new ethers.JsonRpcProvider(XLAYER_TESTNET_RPC);
      const wallet = new ethers.Wallet(COORDINATOR_KEY, provider);
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

      const decimals: bigint = await (usdc.decimals as () => Promise<bigint>)();
      const amount = ethers.parseUnits(amountUSDC.toString(), Number(decimals));

      const tx = await (usdc.transfer as (to: string, amount: bigint) => Promise<ethers.TransactionResponse>)(agentWallet, amount);
      const receipt = await tx.wait();
      const hash = receipt?.hash ?? tx.hash;

      console.log(`✅ [x402] Real payment: $${amountUSDC} USDC → ${agentId} wallet`);
      console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${hash}`);

      return { txHash: hash, amountUsd: amountUSDC, agentWallet, real: true };
    } catch (err) {
      console.warn(`⚠️  [x402] Real payment failed, falling back to simulation:`, err);
    }
  }

  // --- Simulation fallback ---
  const fakeHash = `x402-sim-${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`🔵 [x402] Simulated payment: $${amountUSDC} USDC → ${agentId}`);
  return { txHash: fakeHash, amountUsd: amountUSDC, agentWallet, real: false };
}

/** Agent wallet addresses — set via env or use placeholder addresses for simulation */
export const AGENT_WALLETS: Record<string, string> = {
  technical: process.env.TECHNICAL_AGENT_WALLET ?? "0x1111111111111111111111111111111111111111",
  whale:     process.env.WHALE_AGENT_WALLET     ?? "0x2222222222222222222222222222222222222222",
  sentiment: process.env.SENTIMENT_AGENT_WALLET ?? "0x3333333333333333333333333333333333333333",
};

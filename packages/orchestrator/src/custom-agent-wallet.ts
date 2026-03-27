/**
 * custom-agent-wallet.ts
 * Generates deterministic agent wallets for receiving x402 payments.
 */
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "ethers";

export interface AgentWalletInfo {
  address: string;
  privateKey: string;
  mnemonic: string;
}

export interface AgentBalance {
  OKB: string;
  USDC: string;
}

// ─── Generate a fresh random wallet for a new agent ──────────────────────────
export function generateAgentWallet(): AgentWalletInfo {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic!.phrase,
  };
}

// ─── Get OKB + USDC balances for an agent wallet ─────────────────────────────
export async function getAgentBalance(agentWallet: string): Promise<AgentBalance> {
  const XLAYER_RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
  const USDC_ADDRESS = process.env.XLAYER_USDC_ADDRESS;

  const provider = new ethers.JsonRpcProvider(XLAYER_RPC);

  const okbWei = await provider.getBalance(agentWallet);
  const okb = ethers.formatEther(okbWei);

  let usdc = "0.00";
  if (USDC_ADDRESS) {
    try {
      const erc20 = new ethers.Contract(
        USDC_ADDRESS,
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );
      const rawUsdc: bigint = await (erc20.balanceOf as Function)(agentWallet);
      usdc = (Number(rawUsdc) / 1e6).toFixed(2);
    } catch {
      // USDC unavailable — return 0
    }
  }

  return { OKB: Number(okb).toFixed(6), USDC: usdc };
}

/**
 * agent-registry-service.ts
 * Interacts with the AgentRegistry contract on X Layer Testnet.
 * Handles agent registration, listing, and running custom agents.
 */
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { ethers } from "ethers";
import { createRequire } from "module";
import { applyOverride } from "./agent-overrides.js";
const require = createRequire(import.meta.url);
// Load compiled artifact (TE: hardhat compile produces this)
const AgentRegistryABI = require("../../../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json");

const XLAYER_RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY;
const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS;

const provider = new ethers.JsonRpcProvider(XLAYER_RPC);
const coordinatorWallet = COORDINATOR_KEY
  ? new ethers.Wallet(COORDINATOR_KEY, provider)
  : null;

function getRegistry(signer?: ethers.Signer) {
  if (!AGENT_REGISTRY_ADDRESS) throw new Error("AGENT_REGISTRY_ADDRESS not set");
  return new ethers.Contract(
    AGENT_REGISTRY_ADDRESS,
    AgentRegistryABI.abi,
    signer ?? provider
  );
}

// ─── Agent type label ─────────────────────────────────────────────────────────
const AGENT_TYPE_LABELS = [
  "MOMENTUM", "CONTRARIAN", "ONCHAIN", "SENTIMENT", "TECHNICAL", "CUSTOM"
] as const;

// ─── Register a new agent onchain ────────────────────────────────────────────
export async function registerAgent(params: {
  name: string;
  description: string;
  strategy: string;
  agentType: number;
  agentWallet: string;
  signalPriceUSDC: number;
  ownerPrivateKey: string;
}): Promise<{ agentId: number; txHash: string }> {
  const ownerWallet = new ethers.Wallet(params.ownerPrivateKey, provider);
  const registry = getRegistry(ownerWallet);

  const priceInMicro = Math.round(params.signalPriceUSDC * 1e6);

  const tx = await (registry.registerAgent as Function)(
    params.name,
    params.description,
    params.strategy,
    params.agentType,
    params.agentWallet,
    priceInMicro
  ) as ethers.TransactionResponse;

  const receipt = await tx.wait();
  if (!receipt) throw new Error("Transaction receipt not received");

  const event = receipt.logs.find(
    (l: any) => l.fragment?.name === "AgentRegistered"
  ) as any;
  const agentId = Number(event?.args?.[0] ?? 0);

  console.log(`✅ [AgentRegistry] Agent "${params.name}" registered with id ${agentId}`);
  return { agentId, txHash: receipt.hash };
}

// ─── Get all active agents from contract ─────────────────────────────────────
export async function getAllAgents(): Promise<AgentInfo[]> {
  if (!AGENT_REGISTRY_ADDRESS) return [];

  const registry = getRegistry();
  const count = Number(await (registry.agentCount as Function)());
  const agents: AgentInfo[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const agent = await (registry.getAgent as Function)(i);
      if (Number(agent.status) !== 0) continue; // skip non-ACTIVE

      const accuracy = await (registry.getAgentAccuracy as Function)(i);
      const baseAgent = {
        id: Number(agent.id),
        owner: agent.owner as string,
        agentWallet: agent.agentWallet as string,
        name: agent.name as string,
        description: agent.description as string,
        agentType: Number(agent.agentType),
        agentTypeLabel: AGENT_TYPE_LABELS[Number(agent.agentType)] ?? "CUSTOM",
        status: Number(agent.status),
        signalPrice: Number(agent.signalPriceUSDC) / 1e6,
        totalHires: Number(agent.totalHires),
        totalEarned: Number(agent.totalEarned) / 1e6,
        accuracy: Number(accuracy),
        strategy: agent.strategy as string,
        registeredAt: new Date(Number(agent.registeredAt) * 1000).toISOString(),
        lastActiveAt: new Date(Number(agent.lastActiveAt) * 1000).toISOString(),
      };
      agents.push(applyOverride(baseAgent));
    } catch {
      // Skip agents that fail fetching
    }
  }

  // Sort by totalEarned desc (marketplace leaderboard)
  return agents.sort((a, b) => b.totalEarned - a.totalEarned);
}

// ─── Get a single agent by id ─────────────────────────────────────────────────
export async function getAgentById(id: number): Promise<AgentInfo | null> {
  if (!AGENT_REGISTRY_ADDRESS) return null;
  try {
    const registry = getRegistry();
    const agent = await (registry.getAgent as Function)(id);
    const accuracy = await (registry.getAgentAccuracy as Function)(id);
    const baseAgent = {
      id: Number(agent.id),
      owner: agent.owner as string,
      agentWallet: agent.agentWallet as string,
      name: agent.name as string,
      description: agent.description as string,
      agentType: Number(agent.agentType),
      agentTypeLabel: AGENT_TYPE_LABELS[Number(agent.agentType)] ?? "CUSTOM",
      status: Number(agent.status),
      signalPrice: Number(agent.signalPriceUSDC) / 1e6,
      totalHires: Number(agent.totalHires),
      totalEarned: Number(agent.totalEarned) / 1e6,
      accuracy: Number(accuracy),
      strategy: agent.strategy as string,
      registeredAt: new Date(Number(agent.registeredAt) * 1000).toISOString(),
      lastActiveAt: new Date(Number(agent.lastActiveAt) * 1000).toISOString(),
    };
    return applyOverride(baseAgent);
  } catch {
    return null;
  }
}

// ─── Get agents owned by a wallet ────────────────────────────────────────────
export async function getOwnerAgents(ownerAddress: string): Promise<AgentInfo[]> {
  if (!AGENT_REGISTRY_ADDRESS) return [];
  try {
    const registry = getRegistry();
    const ids: bigint[] = await (registry.getOwnerAgents as Function)(ownerAddress);
    const agents = await Promise.all(ids.map(id => getAgentById(Number(id))));
    return agents.filter(Boolean) as AgentInfo[];
  } catch {
    return [];
  }
}

// ─── Run a custom agent's strategy via LLM ───────────────────────────────────
export async function runCustomAgent(
  agentId: number,
  pair: string,
  marketData: MarketData
): Promise<CustomAgentSignal> {
  const registry = getRegistry(coordinatorWallet ?? undefined);
  const agentInfo = await getAgentById(agentId);
  if (!agentInfo) throw new Error("Agent not found");

  const strategy = agentInfo.strategy;

  const prompt = `You are a trading signal agent with this strategy:
"${strategy}"

Current market data for ${pair}:
- EMA Short: ${marketData.shortEma}
- EMA Long: ${marketData.longEma}
- RSI: ${marketData.rsi}
- Whale Flow Score: ${marketData.whaleFlowScore}
- Sentiment Score: ${marketData.sentimentScore}
- Price: ${marketData.currentPrice}
- 24h Change: ${marketData.change24h}%

Based ONLY on your strategy, give a verdict.
Respond in JSON only (no markdown, no explanation outside JSON):
{"verdict":"BUY","confidence":75,"reasoning":"one sentence explanation"}`;

  const result = await callLLM(prompt);

  // Record the hire onchain if coordinator wallet is available
  if (coordinatorWallet && AGENT_REGISTRY_ADDRESS) {
    try {
      const tx = await (registry.recordHire as Function)(
        agentId,
        coordinatorWallet.address,
        pair,
        Math.round(agentInfo.signalPrice * 1e6),
        result.verdict
      ) as ethers.TransactionResponse;
      await tx.wait();
      console.log(`✅ [Custom Agent ${agentId}] Hire recorded for ${pair}: ${result.verdict}`);
    } catch (err) {
      console.warn(`⚠️  [Custom Agent ${agentId}] recordHire failed:`, err);
    }
  }

  return {
    agentId,
    agentName: agentInfo.name,
    pair,
    ...result,
  };
}

// ─── Simple Gemini REST caller ────────────────────────────────────────────────
async function callLLM(prompt: string): Promise<{ verdict: "BUY" | "SELL" | "HOLD"; confidence: number; reasoning: string }> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      };
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
      const json = await resp.json() as any;
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn("[LLM] Gemini REST failed, using mock signal:", err);
    }
  }

  // Deterministic mock fallback
  const hash = prompt.length + prompt.charCodeAt(0);
  const verdicts = ["BUY", "SELL", "HOLD"] as const;
  return {
    verdict: verdicts[hash % 3]!,
    confidence: 50 + (hash % 30),
    reasoning: "Signal generated by fallback heuristic (LLM unavailable).",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AgentInfo {
  id: number;
  owner: string;
  agentWallet: string;
  name: string;
  description: string;
  agentType: number;
  agentTypeLabel: string;
  status: number;
  signalPrice: number;
  totalHires: number;
  totalEarned: number;
  accuracy: number;
  strategy: string;
  registeredAt: string;
  lastActiveAt: string;
}

export interface MarketData {
  shortEma: number;
  longEma: number;
  rsi: number;
  whaleFlowScore: number;
  sentimentScore: number;
  currentPrice: number;
  change24h: number;
}

export interface CustomAgentSignal {
  agentId: number;
  agentName: string;
  pair: string;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
}

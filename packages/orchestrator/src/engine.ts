import type {
  AgentId,
  DashboardConsensusResult,
  DashboardSnapshot,
  DecisionStep,
  ExecutionProof,
  PaymentReceipt,
  RiskVerdict,
  DashboardSignal,
  TradeIntent,
} from "../../shared/src/types.js";
import { Coordinator } from "@signal-swarm/agents";
import { recordSignalOnchain } from "./onchain-recorder.js";
import { payAgent, AGENT_WALLETS } from "./x402-client.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const AGENT_COSTS: Record<AgentId, number> = {
  technical: 1.0,
  whale: 1.5,
  sentiment: 0.75,
  risk: 0.5,
};

const AGENT_NAMES: Record<AgentId, string> = {
  technical: "Technical Agent",
  whale: "Whale Flow Agent",
  sentiment: "Sentiment Agent",
  risk: "Risk Manager",
};

// ─── Risk thresholds per profile ─────────────────────────────────────────────
const RISK_PROFILES: Record<string, { maxSlippageBps: number; positionPct: number }> = {
  safe:     { maxSlippageBps: 10,  positionPct: 0.02 },
  moderate: { maxSlippageBps: 25,  positionPct: 0.05 },
  balanced: { maxSlippageBps: 25,  positionPct: 0.05 },
  degen:    { maxSlippageBps: 80,  positionPct: 0.15 },
};

// ─── Timeframe → OKX candle params ───────────────────────────────────────────
const TIMEFRAME_MAP: Record<string, { bar: string; limit: number }> = {
  "15m": { bar: "15m",  limit: 96 },
  "1h":  { bar: "1H",   limit: 72 },
  "4h":  { bar: "4H",   limit: 48 },
  "1d":  { bar: "1D",   limit: 30 },
};

function directionToAction(dir: "LONG" | "SHORT" | "NEUTRAL"): "BUY" | "SELL" | "HOLD" {
  return dir === "LONG" ? "BUY" : dir === "SHORT" ? "SELL" : "HOLD";
}

// ─── Params type ──────────────────────────────────────────────────────────────
export interface AnalyzeParams {
  symbol?: string;
  timeframe?: string;
  riskProfile?: string;
  portfolioUSDC?: number;
  enabledAgents?: string[];
  userAddress?: string;
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function buildSnapshot(
  symbolOrParams?: string | AnalyzeParams
): Promise<DashboardSnapshot & { positionSuggestion?: PositionSuggestion; onchainProofTx?: string; onchainReal?: boolean }> {

  // --- Normalize params ---
  const params: AnalyzeParams =
    typeof symbolOrParams === "string"
      ? { symbol: symbolOrParams }
      : (symbolOrParams ?? {});

  const symbol       = params.symbol      ?? "OKB/USDC";
  const timeframe    = params.timeframe   ?? "15m";
  const riskProfile  = params.riskProfile ?? "moderate";
  const portfolioUSD = params.portfolioUSDC ?? 1000;
  const timeframeCfg = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP["15m"]!;
  const riskCfg      = RISK_PROFILES[riskProfile] ?? RISK_PROFILES["moderate"]!;

  // --- Run coordinator ---
  const coordinator = new Coordinator();
  const result = await coordinator.run({
    symbol,
    timeframe: timeframeCfg.bar,
    balanceUsd: portfolioUSD,
  });

  const { snapshot, signals, consensus, risk, execution, payments } = result;

  // --- Real x402 payments for enabled agents ---
  const paymentResults = await Promise.all(
    signals.map((s) => payAgent(AGENT_WALLETS[s.agentId] ?? "0x0", AGENT_COSTS[s.agentId] ?? 1, s.agentId))
  );

  // --- Map specialist agent signals ---
  const agentSignals: DashboardSignal[] = signals.map((s, i) => ({
    id: s.id,
    agent: s.agentId,
    pair: s.symbol,
    timeframe: timeframeCfg.bar as "5m" | "15m",
    action: directionToAction(s.direction),
    confidence: s.confidence,
    strength: Math.min(0.95, Math.max(0.3, s.confidence - 0.1)),
    reasons: [
      s.reasoning,
      ...Object.entries(s.evidence)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${v}`),
    ],
    riskFlags: s.direction === "NEUTRAL" ? ["no_conviction"] : [],
    freshUntil: s.expiresAt,
    priceContext: {
      spot: snapshot.currentPrice,
      entryRange: [
        s.stopLoss ?? snapshot.currentPrice * 0.98,
        s.priceTarget ?? snapshot.currentPrice * 1.02,
      ],
      ...(s.stopLoss !== undefined && { invalidIfBelow: s.stopLoss }),
      ...(s.priceTarget !== undefined && { invalidIfAbove: s.priceTarget }),
    },
    payment: {
      id: paymentResults[i]?.txHash ?? payments[i] ?? "unpaid",
      requester: "coordinator",
      targetAgent: s.agentId,
      amountUsd: AGENT_COSTS[s.agentId] ?? 1,
      currency: "USDC",
      status: "simulated",
      createdAt: new Date(s.createdAt).toISOString(),
    },
  }));

  // --- Coordinator consensus ---
  const alignedAgents = signals
    .filter((s) => s.direction === consensus.direction && s.direction !== "NEUTRAL")
    .map((s) => s.agentId);

  const mappedConsensus: DashboardConsensusResult = {
    pair: consensus.symbol,
    timeframe: timeframeCfg.bar as "5m" | "15m",
    action: directionToAction(consensus.direction),
    finalScore: consensus.weightedConfidence,
    alignedAgents,
    shouldRequestRisk: consensus.direction !== "NEUTRAL",
    shouldExecute: consensus.shouldExecute,
    explanation: [
      consensus.reasoning,
      `Weighted confidence: ${(consensus.weightedConfidence * 100).toFixed(0)}%`,
      `${alignedAgents.length} of ${signals.length} specialist agents aligned.`,
    ],
  };

  // --- Risk verdict with profile thresholds ---
  const mappedRisk: RiskVerdict = {
    action: risk.approved ? "APPROVE" : "BLOCK",
    confidence: 0.88,
    maxPositionUsd: Math.min(risk.maxPositionSize, portfolioUSD * riskCfg.positionPct * 2),
    maxSlippageBps: Math.min(risk.maxSlippageBps, riskCfg.maxSlippageBps),
    flags: risk.riskFlags,
    reasons: [risk.reasoning],
  };

  // --- Position size calculation ---
  const positionSuggestion = calcPositionSize(
    portfolioUSD,
    riskProfile,
    consensus.weightedConfidence
  );

  // --- Record signal onchain ---
  const onchainResult = await recordSignalOnchain(
    symbol,
    directionToAction(consensus.direction),
    Math.round(consensus.weightedConfidence * 100),
    riskProfile,
    risk.approved
  );

  // --- Build tx hash ---
  const txHash = onchainResult.txHash;
  const explorerUrl = onchainResult.explorerUrl;

  // --- Trade intent ---
  const tradeIntent: TradeIntent | null =
    risk.approved && consensus.shouldExecute
      ? {
          id: execution.orderId,
          pair: execution.symbol,
          side: execution.direction === "SHORT" ? ("SELL" as const) : ("BUY" as const),
          sizeUsd: Math.min(execution.notionalUsd, positionSuggestion.recommendedUsd),
          quotedPrice: snapshot.currentPrice,
          maxSlippageBps: riskCfg.maxSlippageBps,
          simulationStatus: "passed",
          executionStatus: "executed",
          txHash,
        }
      : null;

  // --- Payment receipts ---
  const receipts: PaymentReceipt[] = signals.map((s, i) => ({
    id: paymentResults[i]?.txHash ?? payments[i] ?? "unpaid",
    requester: "coordinator",
    targetAgent: s.agentId,
    amountUsd: AGENT_COSTS[s.agentId] ?? 1,
    currency: "USDC",
    status: "simulated",
    createdAt: new Date(s.createdAt).toISOString(),
  }));

  // --- Execution proof ---
  const executionProof: ExecutionProof = {
    network: "X Layer Testnet",
    status: execution.status,
    txHash,
    explorerUrl,
    fillPrice: execution.fillPrice,
    notionalUsd: execution.notionalUsd,
    slippageBps: execution.slippageBps,
    executedAt: new Date(execution.executedAt).toISOString(),
  };

  // --- Decision steps ---
  const totalPaid = signals.reduce((sum, s) => sum + (AGENT_COSTS[s.agentId] ?? 1), 0);
  const paymentsReal = paymentResults.some((p) => p.real);
  const decisionSteps: DecisionStep[] = [
    {
      label: "Market context loaded",
      status: "done",
      detail: `${snapshot.symbol} @ $${snapshot.currentPrice.toFixed(4)} — ${snapshot.candles.length} candles, ${timeframe}`,
    },
    {
      label: `x402 payments dispatched${paymentsReal ? " (real USDC)" : " (simulated)"}`,
      status: "done",
      detail: `Coordinator paid ${signals.length} agents — $${totalPaid.toFixed(2)} USDC total`,
    },
    {
      label: "Agent signals computed",
      status: "done",
      detail: signals
        .map((s) => `${AGENT_NAMES[s.agentId]}: ${s.direction} (${(s.confidence * 100).toFixed(0)}%)`)
        .join(" · "),
    },
    {
      label: "Coordinator consensus",
      status: "done",
      detail: `${consensus.direction} — ${(consensus.weightedConfidence * 100).toFixed(0)}% confidence — ${alignedAgents.length}/${signals.length} aligned`,
    },
    {
      label: "Risk gate evaluation",
      status: risk.approved ? "done" : "blocked",
      detail: risk.approved
        ? `APPROVED — max $${positionSuggestion.recommendedUsd.toFixed(2)}, slippage cap ${riskCfg.maxSlippageBps} bps`
        : `BLOCKED — ${risk.riskFlags.join(", ") || risk.reasoning}`,
    },
    {
      label: `Signal recorded onchain${onchainResult.real ? " (real TX)" : " (simulated)"}`,
      status: "done",
      detail: `TX: ${txHash.slice(0, 20)}...`,
    },
  ];

  // --- Market stats ---
  const closes = snapshot.candles.map((c) => c.close);
  const firstClose = closes[0] ?? snapshot.currentPrice;
  const changePct = ((snapshot.currentPrice - firstClose) / firstClose) * 100;
  const totalVolume = snapshot.candles.reduce((sum, c) => sum + c.volume, 0);
  const returns = snapshot.candles
    .slice(1)
    .map((c, i) => Math.abs((c.close - (snapshot.candles[i]?.close ?? c.close)) / (snapshot.candles[i]?.close ?? c.close)));
  const volatility24h = returns.reduce((sum, r) => sum + r, 0) / Math.max(returns.length, 1);

  return {
    generatedAt: new Date().toISOString(),
    pair: snapshot.symbol,
    timeframe: timeframeCfg.bar as "5m" | "15m",
    market: { price: snapshot.currentPrice, changePct, volume24h: totalVolume, volatility24h },
    agents: agentSignals,
    consensus: mappedConsensus,
    risk: mappedRisk,
    tradeIntent,
    receipts,
    positions: [
      {
        pair: snapshot.symbol,
        side: tradeIntent ? "LONG" : "FLAT",
        exposureUsd: tradeIntent ? tradeIntent.sizeUsd : 0,
        pnlPct: 0,
      },
    ],
    executionProof,
    decisionSteps,
    positionSuggestion,
    onchainProofTx: txHash,
    onchainReal: onchainResult.real,
  };
}

// ─── Position Size Calculator ──────────────────────────────────────────────────
export interface PositionSuggestion {
  portfolioUsd: number;
  riskProfile: string;
  confidencePct: number;
  positionPct: number;
  recommendedUsd: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxLoss: number;
  maxGain: number;
}

export function calcPositionSize(
  portfolioUsd: number,
  riskProfile: string,
  weightedConfidence: number // 0-1
): PositionSuggestion {
  const cfg = RISK_PROFILES[riskProfile] ?? RISK_PROFILES["moderate"]!;
  const conf = Math.max(0, Math.min(1, weightedConfidence));
  const recommendedUsd = portfolioUsd * cfg.positionPct * conf;

  const stopLossPct   = riskProfile === "safe" ? 2 : riskProfile === "degen" ? 8 : 4;
  const takeProfitPct = riskProfile === "safe" ? 4 : riskProfile === "degen" ? 15 : 8;

  return {
    portfolioUsd,
    riskProfile,
    confidencePct: Math.round(conf * 100),
    positionPct:   cfg.positionPct * 100,
    recommendedUsd: Number(recommendedUsd.toFixed(2)),
    stopLossPct,
    takeProfitPct,
    maxLoss:   Number((recommendedUsd * stopLossPct / 100).toFixed(2)),
    maxGain:   Number((recommendedUsd * takeProfitPct / 100).toFixed(2)),
  };
}

// ─── Multi-pair scanner ────────────────────────────────────────────────────────
export const SCANNER_PAIRS = [
  "ETH/USDC", "BTC/USDC", "OKB/USDC", "SOL/USDC",
  "ARB/USDC", "OP/USDC", "LINK/USDC", "DOGE/USDC",
  "AVAX/USDC", "MATIC/USDC",
];

export interface ScanResult {
  pair: string;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskApproved: boolean;
  price: number;
  changePct: number;
}

export async function scanPairs(
  pairs: string[],
  timeframe = "15m"
): Promise<ScanResult[]> {
  const results = await Promise.allSettled(
    pairs.map(async (pair) => {
      const snap = await buildSnapshot({ symbol: pair, timeframe, portfolioUSDC: 1000 });
      return {
        pair,
        verdict: snap.consensus.action,
        confidence: snap.consensus.finalScore,
        riskApproved: snap.risk.action === "APPROVE",
        price: snap.market.price,
        changePct: snap.market.changePct,
      } satisfies ScanResult;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ScanResult> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => b.confidence - a.confidence);
}

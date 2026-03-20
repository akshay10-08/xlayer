import {
  type AgentId,
  type ConsensusResult,
  type DashboardSnapshot,
  type Direction,
  type PaymentReceipt,
  type RiskVerdict,
  type Signal,
  type TradeIntent,
  mockMarketContext
} from "@signal-swarm/shared";

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createReceipt(targetAgent: AgentId, amountUsd: number): PaymentReceipt {
  return {
    id: createId("x402"),
    requester: "coordinator",
    targetAgent,
    amountUsd,
    currency: "USDC",
    status: "simulated",
    createdAt: new Date().toISOString()
  };
}

function actionFromScore(score: number): Direction {
  if (score > 0.2) {
    return "BUY";
  }
  if (score < -0.2) {
    return "SELL";
  }
  return "HOLD";
}

function buildTechnicalSignal(): Signal {
  const closes = mockMarketContext.candles.map((candle) => candle.close);
  const volumes = mockMarketContext.candles.map((candle) => candle.volume);
  const shortTrend = mean(closes.slice(-3));
  const longTrend = mean(closes);
  const momentum = (closes.at(-1)! - closes.at(-4)!) / closes.at(-4)!;
  const volumeRatio = volumes.at(-1)! / mean(volumes.slice(0, -1));
  const score = (shortTrend - longTrend) / longTrend + momentum + (volumeRatio - 1) * 0.25;
  const action = actionFromScore(score);

  return {
    id: createId("sig"),
    agent: "technical",
    pair: mockMarketContext.pair,
    timeframe: mockMarketContext.timeframe,
    action,
    confidence: Math.min(0.88, Math.max(0.4, Math.abs(score) * 4.5)),
    strength: Math.min(0.95, Math.max(0.35, volumeRatio * 0.5)),
    reasons: [
      `Short trend ${shortTrend.toFixed(2)} is above long trend ${longTrend.toFixed(2)}.`,
      `Momentum over the last four candles is ${(momentum * 100).toFixed(2)}%.`,
      `Latest volume is ${volumeRatio.toFixed(2)}x the recent baseline.`
    ],
    riskFlags: mockMarketContext.volatility24h > 0.05 ? ["elevated_volatility"] : [],
    freshUntil: Date.now() + 5 * 60_000,
    priceContext: {
      spot: mockMarketContext.price,
      entryRange: [52.3, 52.8],
      invalidIfBelow: 51.7
    },
    payment: createReceipt("technical", 0.002)
  };
}

function buildWhaleSignal(): Signal {
  const score = mockMarketContext.whaleBias * 2 - 1;
  const action = actionFromScore(score);

  return {
    id: createId("sig"),
    agent: "whale",
    pair: mockMarketContext.pair,
    timeframe: mockMarketContext.timeframe,
    action,
    confidence: Math.max(0.35, mockMarketContext.whaleBias * 0.95),
    strength: Math.max(0.3, mockMarketContext.whaleBias * 0.9),
    reasons: [
      "Smart-money flows lean net positive over the last three observation windows.",
      "No large distribution cluster is visible in the mock wallet cohort.",
      "Coordinator sees consistent accumulation rather than one-off noisy spikes."
    ],
    riskFlags: [],
    freshUntil: Date.now() + 5 * 60_000,
    priceContext: {
      spot: mockMarketContext.price,
      entryRange: [52.4, 52.9],
      invalidIfBelow: 51.9
    },
    payment: createReceipt("whale", 0.003)
  };
}

function buildSentimentSignal(): Signal {
  const score = mockMarketContext.sentimentScore * 2 - 1;
  const action = actionFromScore(score);

  return {
    id: createId("sig"),
    agent: "sentiment",
    pair: mockMarketContext.pair,
    timeframe: mockMarketContext.timeframe,
    action,
    confidence: Math.max(0.3, mockMarketContext.sentimentScore * 0.85),
    strength: Math.max(0.25, mockMarketContext.sentimentScore * 0.8),
    reasons: [
      "Narrative momentum remains constructive in the mock feed.",
      "Attention is rising, but not at a euphoric level.",
      "Sentiment contributes confirmation rather than being the sole driver."
    ],
    riskFlags: [],
    freshUntil: Date.now() + 5 * 60_000,
    priceContext: {
      spot: mockMarketContext.price,
      entryRange: [52.2, 52.85],
      invalidIfBelow: 51.8
    },
    payment: createReceipt("sentiment", 0.002)
  };
}

function scoreSignal(signal: Signal): number {
  const direction = signal.action === "BUY" ? 1 : signal.action === "SELL" ? -1 : 0;
  const freshness = signal.freshUntil > Date.now() ? 1 : 0;
  const quality = 1 - signal.riskFlags.length * 0.1;
  return direction * signal.confidence * freshness * Math.max(0.6, quality);
}

function buildConsensus(signals: Signal[]): ConsensusResult {
  const weights: Record<Exclude<AgentId, "risk">, number> = {
    technical: 0.4,
    whale: 0.35,
    sentiment: 0.25
  };

  const weightedScore = signals.reduce((total, signal) => {
    if (signal.agent === "risk") {
      return total;
    }
    return total + scoreSignal(signal) * weights[signal.agent];
  }, 0);

  const action = actionFromScore(weightedScore);
  const alignedAgents = signals
    .filter((signal) => signal.action === action && signal.action !== "HOLD")
    .map((signal) => signal.agent);
  const shouldRequestRisk = action !== "HOLD" && alignedAgents.length >= 2;

  return {
    pair: mockMarketContext.pair,
    timeframe: mockMarketContext.timeframe,
    action,
    finalScore: Number(weightedScore.toFixed(3)),
    alignedAgents,
    shouldRequestRisk,
    shouldExecute: false,
    explanation: [
      `Weighted score resolved to ${weightedScore.toFixed(3)}.`,
      `${alignedAgents.length} specialist agents align on ${action}.`,
      shouldRequestRisk ? "Risk review was requested." : "Consensus was too weak to escalate."
    ]
  };
}

function buildRiskVerdict(consensus: ConsensusResult): RiskVerdict {
  const maxPositionUsd = Math.min(200, mockMarketContext.availableBalanceUsd * 0.2);
  const blocked =
    !consensus.shouldRequestRisk ||
    mockMarketContext.walletExposureUsd > 400 ||
    mockMarketContext.volatility24h > 0.08;

  return {
    action: blocked ? "BLOCK" : "APPROVE",
    confidence: blocked ? 0.82 : 0.91,
    maxPositionUsd,
    maxSlippageBps: 120,
    flags: blocked ? ["insufficient_alignment"] : ["simulation_required"],
    reasons: blocked
      ? ["Risk review rejected the trade because alignment or exposure constraints were not met."]
      : [
          "Wallet exposure is below the configured cap.",
          "Mock slippage threshold stays under 120 bps.",
          "Coordinator may proceed to simulated execution."
        ]
  };
}

function buildTradeIntent(consensus: ConsensusResult, risk: RiskVerdict): TradeIntent | null {
  if (risk.action === "BLOCK" || consensus.action === "HOLD") {
    return null;
  }

  return {
    id: createId("trade"),
    pair: mockMarketContext.pair,
    side: consensus.action === "BUY" ? "BUY" : "SELL",
    sizeUsd: Math.min(risk.maxPositionUsd, 125),
    quotedPrice: mockMarketContext.price,
    maxSlippageBps: risk.maxSlippageBps,
    simulationStatus: "passed",
    executionStatus: "ready",
    txHash: "0xsimulatedf4c17c9b0a"
  };
}

export function buildSnapshot(): DashboardSnapshot {
  const signals = [buildTechnicalSignal(), buildWhaleSignal(), buildSentimentSignal()];
  const consensus = buildConsensus(signals);
  const risk = buildRiskVerdict(consensus);
  const tradeIntent = buildTradeIntent(consensus, risk);

  consensus.shouldExecute = Boolean(
    tradeIntent &&
      risk.action === "APPROVE" &&
      tradeIntent.simulationStatus === "passed"
  );

  return {
    generatedAt: new Date().toISOString(),
    pair: mockMarketContext.pair,
    timeframe: mockMarketContext.timeframe,
    market: {
      price: mockMarketContext.price,
      changePct: mockMarketContext.changePct,
      volume24h: mockMarketContext.volume24h,
      volatility24h: mockMarketContext.volatility24h
    },
    agents: signals,
    consensus,
    risk,
    tradeIntent,
    receipts: signals.map((signal) => signal.payment),
    positions: [
      {
        pair: mockMarketContext.pair,
        side: tradeIntent ? "LONG" : "FLAT",
        exposureUsd: mockMarketContext.walletExposureUsd,
        pnlPct: 2.8
      }
    ],
    auditTrail: [
      "Coordinator opened a new 15m round for OKB/USDC.",
      "Specialist agents returned paid signals through simulated x402 receipts.",
      `Consensus resolved to ${consensus.action} with score ${consensus.finalScore}.`,
      `Risk verdict: ${risk.action}.`,
      tradeIntent
        ? `Simulation passed and trade intent ${tradeIntent.id} is ready.`
        : "No trade intent was created for this round."
    ]
  };
}

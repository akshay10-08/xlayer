import type {
  DashboardSnapshot,
  DecisionStep,
  ExecutionProof,
  PaymentRow,
  RiskGate,
} from "../types";

const MOCK_PATH = "/mock-data.json";
const API_URL = (import.meta.env.VITE_SIGNAL_SWARM_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
);

const AGENT_NAMES: Record<string, string> = {
  technical: "Technical Agent",
  whale: "Whale Flow Agent",
  sentiment: "Sentiment Agent",
  risk: "Risk Manager",
};

interface ApiSignal {
  agent: "technical" | "whale" | "sentiment" | "risk";
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasons: string[];
  payment: { id: string; amountUsd: number; createdAt: string };
}

interface ApiReceipt {
  id: string;
  targetAgent: string;
  amountUsd: number;
  createdAt: string;
}

interface ApiRisk {
  action: "APPROVE" | "BLOCK";
  maxPositionUsd: number;
  maxSlippageBps: number;
  flags: string[];
  reasons: string[];
}

interface ApiExecutionProof {
  network: string;
  status: string;
  txHash: string;
  explorerUrl: string;
  fillPrice: number;
  notionalUsd: number;
  slippageBps: number;
  executedAt: string;
}

interface ApiDecisionStep {
  label: string;
  status: "done" | "skipped" | "blocked";
  detail: string;
}

interface ApiSnapshot {
  generatedAt: string;
  pair: string;
  market: {
    price: number;
    changePct: number;
    volume24h: number;
    volatility24h: number;
  };
  agents: ApiSignal[];
  consensus: {
    action: "BUY" | "SELL" | "HOLD";
    finalScore: number;
    shouldExecute: boolean;
    explanation: string[];
  };
  risk?: ApiRisk;
  receipts?: ApiReceipt[];
  executionProof?: ApiExecutionProof;
  decisionSteps?: ApiDecisionStep[];
  positions: Array<{
    pair: string;
    side: "LONG" | "FLAT";
    exposureUsd: number;
    pnlPct: number;
  }>;
  tradeIntent: {
    side: "BUY" | "SELL";
    sizeUsd: number;
    quotedPrice: number;
    executionStatus: string;
    txHash?: string;
  } | null;
}

function mapDirection(value: "BUY" | "SELL" | "HOLD") {
  if (value === "BUY") return "LONG" as const;
  if (value === "SELL") return "SHORT" as const;
  return "NEUTRAL" as const;
}

function mapApiSnapshot(snap: ApiSnapshot): DashboardSnapshot {
  const confidence = Math.max(0, Math.min(1, Math.abs(snap.consensus.finalScore)));

  const riskGate: RiskGate | undefined = snap.risk
    ? {
        action: snap.risk.action,
        maxPositionUsd: snap.risk.maxPositionUsd,
        maxSlippageBps: snap.risk.maxSlippageBps,
        flags: snap.risk.flags,
        reason: snap.risk.reasons[0] ?? "",
      }
    : undefined;

  const payments: PaymentRow[] | undefined = snap.receipts?.map((r) => ({
    txId: r.id,
    agentId: r.targetAgent,
    agentName: AGENT_NAMES[r.targetAgent] ?? r.targetAgent,
    amountUsd: r.amountUsd,
    status: "settled" as const,
    settledAt: r.createdAt,
  }));

  const executionProof: ExecutionProof | undefined = snap.executionProof
    ? {
        network: snap.executionProof.network,
        status: snap.executionProof.status,
        txHash: snap.executionProof.txHash,
        explorerUrl: snap.executionProof.explorerUrl,
        fillPrice: `$${snap.executionProof.fillPrice.toFixed(4)}`,
        notionalUsd: `$${snap.executionProof.notionalUsd.toFixed(2)}`,
        slippageBps: `${snap.executionProof.slippageBps.toFixed(1)} bps`,
        executedAt: snap.executionProof.executedAt,
      }
    : undefined;

  const decisionSteps: DecisionStep[] | undefined = snap.decisionSteps;

  return {
    lastUpdated: snap.generatedAt,
    market: {
      symbol: snap.pair,
      price: snap.market.price,
      change24h: snap.market.changePct,
      volume24h: snap.market.volume24h,
      liquidity: snap.market.volatility24h > 0.06 ? "thin" : "deep",
    },
    consensus: {
      direction: mapDirection(snap.consensus.action),
      weightedConfidence: Number(confidence.toFixed(2)),
      shouldExecute: snap.consensus.shouldExecute,
      riskLevel:
        snap.market.volatility24h < 0.04
          ? "low"
          : snap.market.volatility24h < 0.07
          ? "guarded"
          : "elevated",
      reasoning: snap.consensus.explanation[0] ?? "",
    },
    agents: snap.agents
      .filter((a) => a.agent !== "risk")
      .map((agent, index) => ({
        id: agent.agent,
        name: AGENT_NAMES[agent.agent] ?? agent.agent,
        role:
          agent.agent === "technical"
            ? "Trend and momentum"
            : agent.agent === "whale"
            ? "Smart-money detection"
            : "Narrative and attention",
        direction: mapDirection(agent.action),
        confidence: agent.confidence,
        signal: agent.reasons[0] ?? "No signal rationale provided.",
        reasoning: agent.reasons.slice(1, 4).join(" "),
        paidWith: agent.payment.id,
        latencyMs: 80 + index * 45,
      })),
    positions: snap.positions.map((p) => ({
      symbol: p.pair,
      side: p.side,
      size: p.exposureUsd > 0 ? `$${p.exposureUsd.toFixed(0)}` : "$0",
      pnl: `${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(2)}%`,
      status: p.side === "FLAT" ? "Watching" : "Open",
      entry: snap.tradeIntent ? `$${snap.tradeIntent.quotedPrice.toFixed(4)}` : "N/A",
      stop: snap.tradeIntent
        ? `$${(snap.tradeIntent.quotedPrice * 0.985).toFixed(4)}`
        : "N/A",
    })),
    trades: [
      {
        time: new Date(snap.generatedAt).toISOString().slice(11, 16),
        symbol: snap.pair,
        action: snap.tradeIntent?.side ?? "WAIT",
        size: snap.tradeIntent ? `$${snap.tradeIntent.sizeUsd.toFixed(0)}` : "$0",
        result: snap.tradeIntent?.executionStatus ?? "blocked",
        reason: snap.consensus.explanation.at(-1) ?? "Awaiting new round",
      },
    ],
    timeline: snap.agents
      .filter((a) => a.agent !== "risk")
      .map((a) => Math.round(a.confidence * 100)),
    riskGate,
    payments,
    executionProof,
    decisionSteps,
  };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const apiResponse = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (apiResponse.ok) {
      return mapApiSnapshot((await apiResponse.json()) as ApiSnapshot);
    }
  } catch {
    // Fall back to static snapshot when orchestrator is not running.
  }

  const response = await fetch(MOCK_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load dashboard snapshot: ${response.status}`);
  }
  return (await response.json()) as DashboardSnapshot;
}

/** Re-fetch from API. Called periodically to get fresh real computations. */
export async function refreshSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const apiResponse = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (apiResponse.ok) {
      return mapApiSnapshot((await apiResponse.json()) as ApiSnapshot);
    }
  } catch {
    // Orchestrator not running — keep existing snapshot.
  }
  return null;
}

/** Lightweight price drift for demo continuity between polls (price only, not agent logic). */
export function driftPrice(snapshot: DashboardSnapshot, tick: number): DashboardSnapshot {
  const drift = Math.sin(tick / 5) * 0.008 + Math.cos(tick / 9) * 0.003;
  const price = Number((snapshot.market.price * (1 + drift)).toFixed(4));
  const change24h = Number(
    (snapshot.market.change24h + Math.sin(tick / 6) * 0.2).toFixed(2)
  );
  return {
    ...snapshot,
    lastUpdated: new Date().toISOString(),
    market: { ...snapshot.market, price, change24h },
  };
}

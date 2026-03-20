import type { DashboardSnapshot } from "../types";

const MOCK_PATH = "/mock-data.json";
const API_URL = (import.meta.env.VITE_SIGNAL_SWARM_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
);

interface ApiSignal {
  agent: "technical" | "whale" | "sentiment" | "risk";
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasons: string[];
  payment: {
    id: string;
  };
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
  } | null;
  auditTrail: string[];
}

function mapDirection(value: ApiSignal["action"] | ApiSnapshot["consensus"]["action"]) {
  if (value === "BUY") {
    return "LONG" as const;
  }
  if (value === "SELL") {
    return "SHORT" as const;
  }
  return "NEUTRAL" as const;
}

function mapApiSnapshot(snapshot: ApiSnapshot): DashboardSnapshot {
  const confidence = Math.max(0, Math.min(1, Math.abs(snapshot.consensus.finalScore)));

  return {
    lastUpdated: snapshot.generatedAt,
    market: {
      symbol: snapshot.pair,
      price: snapshot.market.price,
      change24h: snapshot.market.changePct,
      volume24h: snapshot.market.volume24h,
      liquidity: snapshot.market.volatility24h > 0.06 ? "thin" : "deep",
    },
    consensus: {
      direction: mapDirection(snapshot.consensus.action),
      weightedConfidence: Number(confidence.toFixed(2)),
      shouldExecute: snapshot.consensus.shouldExecute,
      riskLevel:
        snapshot.market.volatility24h < 0.04
          ? "low"
          : snapshot.market.volatility24h < 0.07
            ? "guarded"
            : "elevated",
      reasoning: snapshot.consensus.explanation.join(" "),
    },
    agents: snapshot.agents.map((agent, index) => ({
      id: agent.agent,
      name:
        agent.agent === "technical"
          ? "Technical"
          : agent.agent === "whale"
            ? "Whale Flow"
            : agent.agent === "sentiment"
              ? "Sentiment"
              : "Risk",
      role:
        agent.agent === "technical"
          ? "Trend and momentum"
          : agent.agent === "whale"
            ? "Smart-money detection"
            : agent.agent === "sentiment"
              ? "Narrative and attention"
              : "Portfolio guardrails",
      direction: mapDirection(agent.action),
      confidence: agent.confidence,
      signal: agent.reasons[0] ?? "No signal rationale provided.",
      reasoning: agent.reasons.join(" "),
      paidWith: agent.payment.id,
      latencyMs: 120 + index * 45,
    })),
    positions: snapshot.positions.map((position) => ({
      symbol: position.pair,
      side: position.side,
      size: `$${position.exposureUsd.toFixed(0)}`,
      pnl: `${position.pnlPct >= 0 ? "+" : ""}${position.pnlPct.toFixed(2)}%`,
      status: position.side === "FLAT" ? "Watching" : "Open",
      entry: snapshot.tradeIntent ? snapshot.tradeIntent.quotedPrice.toFixed(2) : "52.20",
      stop: snapshot.tradeIntent ? (snapshot.tradeIntent.quotedPrice * 0.985).toFixed(2) : "51.40",
    })),
    trades: [
      {
        time: new Date(snapshot.generatedAt).toISOString().slice(11, 16),
        symbol: snapshot.pair,
        action: snapshot.tradeIntent?.side ?? "WAIT",
        size: snapshot.tradeIntent ? `$${snapshot.tradeIntent.sizeUsd.toFixed(0)}` : "$0",
        result: snapshot.tradeIntent?.executionStatus ?? "blocked",
        reason: snapshot.auditTrail.at(-1) ?? "Awaiting new round",
      },
    ],
    timeline: snapshot.agents.map((agent) => Math.round(agent.confidence * 100)),
  };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const apiResponse = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (apiResponse.ok) {
      return mapApiSnapshot((await apiResponse.json()) as ApiSnapshot);
    }
  } catch {
    // Fall back to the bundled static snapshot when the local API is not running.
  }

  const response = await fetch(MOCK_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load dashboard snapshot: ${response.status}`);
  }
  return (await response.json()) as DashboardSnapshot;
}

export function evolveSnapshot(snapshot: DashboardSnapshot, tick: number): DashboardSnapshot {
  const drift = Math.sin(tick / 3) * 0.012 + Math.cos(tick / 7) * 0.006;
  const price = Number((snapshot.market.price * (1 + drift)).toFixed(4));
  const change24h = Number((snapshot.market.change24h + Math.sin(tick / 4) * 0.4).toFixed(2));
  const confidenceNudge = Math.max(
    0.5,
    Math.min(0.98, snapshot.consensus.weightedConfidence + Math.sin(tick / 5) * 0.02)
  );

  return {
    ...snapshot,
    lastUpdated: new Date().toISOString(),
    market: {
      ...snapshot.market,
      price,
      change24h,
    },
    consensus: {
      ...snapshot.consensus,
      weightedConfidence: Number(confidenceNudge.toFixed(2)),
      shouldExecute: confidenceNudge > 0.78,
      riskLevel:
        confidenceNudge > 0.9 ? "low" : confidenceNudge > 0.78 ? "guarded" : "elevated",
    },
    timeline: snapshot.timeline.map((value, index) =>
      Math.max(24, Math.round(value + Math.sin((tick + index) / 4) * 5))
    ),
    agents: snapshot.agents.map((agent, index) => ({
      ...agent,
      confidence: Number(
        Math.max(0.48, Math.min(0.98, agent.confidence + Math.sin((tick + index) / 6) * 0.02)).toFixed(2)
      ),
    })),
  };
}

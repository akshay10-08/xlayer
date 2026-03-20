export type Direction = "LONG" | "SHORT" | "NEUTRAL" | "FLAT";

export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  liquidity: "thin" | "normal" | "deep";
}

export interface ConsensusSnapshot {
  direction: Exclude<Direction, "FLAT">;
  weightedConfidence: number;
  shouldExecute: boolean;
  riskLevel: "low" | "guarded" | "elevated";
  reasoning: string;
}

export interface AgentSignal {
  id: "technical" | "whale" | "sentiment" | "risk";
  name: string;
  role: string;
  direction: Direction;
  confidence: number;
  signal: string;
  reasoning: string;
  paidWith: string;
  latencyMs: number;
}

export interface PositionRow {
  symbol: string;
  side: string;
  size: string;
  pnl: string;
  status: string;
  entry: string;
  stop: string;
}

export interface TradeRow {
  time: string;
  symbol: string;
  action: string;
  size: string;
  result: string;
  reason: string;
}

export interface DashboardSnapshot {
  lastUpdated: string;
  market: MarketSnapshot;
  consensus: ConsensusSnapshot;
  agents: AgentSignal[];
  positions: PositionRow[];
  trades: TradeRow[];
  timeline: number[];
}

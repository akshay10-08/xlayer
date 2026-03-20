export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type AgentId = "technical" | "whale" | "sentiment" | "risk";

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSnapshot {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  candles: Candle[];
  whaleFlowScore: number;
  sentimentScore: number;
  spreadBps: number;
}

export interface Signal {
  id: string;
  agentId: AgentId;
  symbol: string;
  timeframe: string;
  direction: Direction;
  confidence: number;
  reasoning: string;
  priceTarget?: number;
  stopLoss?: number;
  expiresAt: number;
  paidWith?: string;
  createdAt: number;
  evidence: Record<string, number | string | boolean>;
}

export interface ConsensusResult {
  symbol: string;
  timeframe: string;
  direction: Direction;
  weightedConfidence: number;
  agentVotes: Record<string, Signal>;
  shouldExecute: boolean;
  reasoning: string;
}

export interface RiskDecision {
  approved: boolean;
  maxPositionSize: number;
  maxSlippageBps: number;
  riskFlags: string[];
  reasoning: string;
}

export interface TradeRequest {
  symbol: string;
  direction: Exclude<Direction, "NEUTRAL">;
  positionSizeUsd: number;
  maxSlippageBps: number;
}

export interface TradeExecution {
  orderId: string;
  symbol: string;
  direction: Exclude<Direction, "NEUTRAL">;
  status: "SIMULATED" | "EXECUTED" | "REJECTED";
  fillPrice: number;
  notionalUsd: number;
  slippageBps: number;
  executedAt: number;
  notes: string;
}

export interface RoundResult {
  snapshot: MarketSnapshot;
  signals: Signal[];
  consensus: ConsensusResult;
  risk: RiskDecision;
  execution: TradeExecution;
  payments: string[];
}

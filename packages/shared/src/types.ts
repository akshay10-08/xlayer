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

export interface PriceContext {
  spot: number;
  entryRange: [number, number];
  invalidIfBelow?: number;
  invalidIfAbove?: number;
}

export interface PaymentReceipt {
  id: string;
  requester: "coordinator" | AgentId;
  targetAgent: AgentId;
  amountUsd: number;
  currency: "USDC";
  status: "simulated";
  createdAt: string;
}

export interface RiskVerdict {
  action: "APPROVE" | "BLOCK";
  confidence: number;
  maxPositionUsd: number;
  maxSlippageBps: number;
  flags: string[];
  reasons: string[];
}

export interface TradeIntent {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  sizeUsd: number;
  quotedPrice: number;
  maxSlippageBps: number;
  simulationStatus: "passed" | "failed";
  executionStatus: "ready" | "blocked" | "executed";
  txHash?: string;
}

export interface AgentCard {
  id: AgentId;
  title: string;
  subtitle: string;
}

export interface ExecutionProof {
  network: string;
  status: "EXECUTED" | "SIMULATED" | "REJECTED";
  txHash: string;
  explorerUrl: string;
  fillPrice: number;
  notionalUsd: number;
  slippageBps: number;
  executedAt: string;
}

export interface DecisionStep {
  label: string;
  status: "done" | "skipped" | "blocked";
  detail: string;
}

export interface DashboardSignal {
  id: string;
  agent: AgentId;
  pair: string;
  timeframe: "5m" | "15m";
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  strength: number;
  reasons: string[];
  riskFlags: string[];
  freshUntil: number;
  priceContext: PriceContext;
  payment: PaymentReceipt;
}

export interface DashboardConsensusResult {
  pair: string;
  timeframe: "5m" | "15m";
  action: "BUY" | "SELL" | "HOLD";
  finalScore: number;
  alignedAgents: AgentId[];
  shouldRequestRisk: boolean;
  shouldExecute: boolean;
  explanation: string[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  pair: string;
  timeframe: "5m" | "15m";
  market: {
    price: number;
    changePct: number;
    volume24h: number;
    volatility24h: number;
  };
  agents: DashboardSignal[];
  consensus: DashboardConsensusResult;
  risk: RiskVerdict;
  tradeIntent: TradeIntent | null;
  receipts: PaymentReceipt[];
  positions: Array<{
    pair: string;
    side: "LONG" | "FLAT";
    exposureUsd: number;
    pnlPct: number;
  }>;
  executionProof: ExecutionProof;
  decisionSteps: DecisionStep[];
}

export interface MockMarketContext {
  pair: string;
  timeframe: "5m" | "15m";
  candles: Candle[];
  whaleBias: number;
  sentimentScore: number;
  price: number;
  changePct: number;
  volume24h: number;
  volatility24h: number;
  walletExposureUsd: number;
  availableBalanceUsd: number;
}

export const mockMarketContext: MockMarketContext = {
  pair: "OKB/USDC",
  timeframe: "15m",
  candles: [
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 51.4, volume: 820_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 51.6, volume: 870_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 51.8, volume: 900_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 52.1, volume: 940_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 52.05, volume: 910_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 52.3, volume: 1_120_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 52.48, volume: 1_280_000 },
    { openTime: 0, closeTime: 0, open: 51, high: 52, low: 51, close: 52.62, volume: 1_350_000 }
  ],
  whaleBias: 0.72,
  sentimentScore: 0.61,
  price: 52.62,
  changePct: 3.4,
  volume24h: 18_400_000,
  volatility24h: 0.043,
  walletExposureUsd: 180,
  availableBalanceUsd: 920
};

export const agentCards: AgentCard[] = [
  { id: "technical", title: "Technical", subtitle: "Trend, momentum, range" },
  { id: "whale", title: "Whale Flow", subtitle: "Large wallets, smart money" },
  { id: "sentiment", title: "Sentiment", subtitle: "Narrative, attention, heat" },
  { id: "risk", title: "Risk", subtitle: "Exposure, slippage, simulation" }
];

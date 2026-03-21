import type { ConsensusResult, MarketSnapshot, RoundResult, Signal } from "../../shared/src/types.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";
import { getMarketSnapshotLive, simulateTradeLive } from "../../shared/src/live-okx.js";
import { roundTo } from "../../shared/src/deterministic.js";
import { SentimentAgent } from "./sentiment-agent.js";
import { TechnicalAgent } from "./technical-agent.js";
import { WhaleAgent } from "./whale-agent.js";
import { RiskAgent } from "./risk-agent.js";

export interface CoordinatorOptions {
  symbol?: string;
  timeframe?: string;
  balanceUsd?: number;
  requestedNotionalUsd?: number;
  maxPortfolioExposureUsd?: number;
}

export class Coordinator {
  private readonly ledger = new MockX402Ledger(25);
  private readonly technical = new TechnicalAgent(this.ledger);
  private readonly whale = new WhaleAgent(this.ledger);
  private readonly sentiment = new SentimentAgent(this.ledger);
  private readonly risk = new RiskAgent(this.ledger);

  async run(options: CoordinatorOptions = {}): Promise<RoundResult> {
    this.ledger.credit("coordinator", 100);

    const symbol = options.symbol ?? "OKB/USDC"; // Default to native XLayer token for live data
    const timeframe = options.timeframe ?? "15m";
    const snapshot = getMarketSnapshotLive(symbol, timeframe);
    const signals = [
      await this.technical.analyze(snapshot),
      await this.whale.analyze(snapshot),
      await this.sentiment.analyze(snapshot)
    ];

    const consensus = this.buildConsensus(snapshot, signals);
    const requestedNotionalUsd = options.requestedNotionalUsd ?? Math.max(25, (options.balanceUsd ?? 250) * 0.12);
    const maxPortfolioExposureUsd = options.maxPortfolioExposureUsd ?? (options.balanceUsd ?? 250) * 0.28;
    const simulatedDirection = consensus.direction === "SHORT" ? "SHORT" : "LONG";
    const simulatedExecution = simulateTradeLive({
      symbol,
      direction: simulatedDirection,
      positionSizeUsd: requestedNotionalUsd,
      maxSlippageBps: 18
    }, snapshot);

    const risk = this.risk.assess(snapshot, consensus, {
      balanceUsd: options.balanceUsd ?? 250,
      requestedNotionalUsd,
      maxPortfolioExposureUsd,
      simulatedSlippageBps: simulatedExecution.slippageBps
    });

    const execution = risk.approved && consensus.shouldExecute
      ? simulatedExecution
      : {
          ...simulatedExecution,
          status: "REJECTED" as const,
          notes: risk.approved ? "Consensus failed execution gate." : risk.reasoning
        };

    return {
      snapshot,
      signals,
      consensus,
      risk,
      execution,
      payments: signals.map((signal) => signal.paidWith ?? "unpaid")
    };
  }

  private buildConsensus(snapshot: MarketSnapshot, signals: Signal[]): ConsensusResult {
    const weightedScores = signals.map((signal) => {
      const agentWeight = signal.agentId === "technical" ? 1.2 : signal.agentId === "whale" ? 1.15 : 0.9;
      const signedConfidence = signal.direction === "LONG" ? signal.confidence : signal.direction === "SHORT" ? -signal.confidence : 0;
      return signedConfidence * agentWeight;
    });

    const aggregate = weightedScores.reduce((sum, value) => sum + value, 0);
    const direction = aggregate > 0.15 ? "LONG" : aggregate < -0.15 ? "SHORT" : "NEUTRAL";
    const weightedConfidence = roundTo(Math.min(0.98, Math.abs(aggregate) / 3), 4);
    const voteMap = Object.fromEntries(signals.map((signal) => [signal.agentId, signal]));
    const alignment = signals.filter((signal) => signal.direction === direction).length;
    const shouldExecute = direction !== "NEUTRAL" && weightedConfidence >= 0.45 && alignment >= 2;

    return {
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction,
      weightedConfidence,
      agentVotes: voteMap,
      shouldExecute,
      reasoning: shouldExecute
        ? `Weighted consensus points ${direction.toLowerCase()} with ${alignment}/3 aligned agents.`
        : "Consensus is too weak or conflicted to justify execution."
    };
  }
}

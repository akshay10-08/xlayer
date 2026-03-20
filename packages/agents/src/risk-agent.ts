import type { ConsensusResult, MarketSnapshot, RiskDecision, Signal } from "../../shared/src/types.js";
import { clamp, roundTo } from "../../shared/src/deterministic.js";
import { BaseAgent } from "./agent-base.js";

export interface RiskContext {
  balanceUsd: number;
  requestedNotionalUsd: number;
  maxPortfolioExposureUsd: number;
  simulatedSlippageBps: number;
}

export class RiskAgent extends BaseAgent {
  readonly agentId = "risk" as const;
  readonly cost = 0.5;

  analyze(snapshot: MarketSnapshot): Signal {
    return this.mintSignal(snapshot, {
      agentId: this.agentId,
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction: "NEUTRAL",
      confidence: 0.5,
      reasoning: "Risk agent only evaluates trade plans, not standalone entries.",
      evidence: {
        note: "Use assess() for portfolio gating."
      }
    });
  }

  assess(snapshot: MarketSnapshot, consensus: ConsensusResult, context: RiskContext): RiskDecision {
    const drawdownFromSpread = snapshot.spreadBps > 12 ? 1 : 0;
    const crowding = Object.values(consensus.agentVotes).filter((signal) => signal.direction === consensus.direction).length;
    const confidencePenalty = consensus.weightedConfidence < 0.56 ? 1 : 0;
    
    // HARD LIMITS
    const exceedsExposure = context.requestedNotionalUsd > context.maxPortfolioExposureUsd;
    const exceedsSlippage = context.simulatedSlippageBps > 18;
    
    const riskScore = drawdownFromSpread + confidencePenalty - crowding * 0.15;
    
    // Must pass hard limits AND have a low enough soft risk score
    const approved = !exceedsExposure && !exceedsSlippage && riskScore < 1.2 && consensus.direction !== "NEUTRAL";
    
    const maxPositionSize = roundTo(clamp(context.balanceUsd * 0.18, 10, context.maxPortfolioExposureUsd), 2);
    const maxSlippageBps = Math.max(8, 18 - Math.round(riskScore * 4));

    return {
      approved,
      maxPositionSize,
      maxSlippageBps,
      riskFlags: [
        ...(drawdownFromSpread ? ["wide_spread"] : []),
        ...(confidencePenalty ? ["low_confidence"] : []),
        ...(exceedsExposure ? ["position_too_large"] : []),
        ...(exceedsSlippage ? ["high_slippage"] : [])
      ],
      reasoning: approved
        ? "Consensus and execution conditions are within the configured risk envelope."
        : "One or more risk gates failed, so the coordinator should not place the trade."
    };
  }
}

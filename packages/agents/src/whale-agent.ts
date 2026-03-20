import type { MarketSnapshot, Signal } from "../../shared/src/types.js";
import { normalizeScore } from "../../shared/src/indicators.js";
import { roundTo } from "../../shared/src/deterministic.js";
import { BaseAgent } from "./agent-base.js";

export class WhaleAgent extends BaseAgent {
  readonly agentId = "whale" as const;
  readonly cost = 1.5;

  analyze(snapshot: MarketSnapshot): Signal {
    const flow = snapshot.whaleFlowScore;
    const volumeImpulse = Math.tanh((snapshot.candles.at(-1)?.volume ?? 0) / 10_000 - 0.75);
    const score = normalizeScore(flow * 0.9 + volumeImpulse * 0.35);
    const direction = score > 0.1 ? "LONG" : score < -0.1 ? "SHORT" : "NEUTRAL";

    return this.mintSignal(snapshot, {
      agentId: this.agentId,
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction,
      confidence: Math.min(0.94, Math.max(0.42, Math.abs(score) + 0.36)),
      reasoning: flow > 0
        ? "Smart-money flow is positive and recent volume confirms accumulation."
        : "Whale flow is negative, suggesting distribution or passive sell pressure.",
      priceTarget: roundTo(snapshot.currentPrice * (1 + score * 0.03), 4),
      stopLoss: roundTo(snapshot.currentPrice * (1 - Math.abs(score) * 0.025), 4),
      evidence: {
        whaleFlowScore: roundTo(flow, 4),
        volumeImpulse: roundTo(volumeImpulse, 4),
        score
      }
    });
  }
}

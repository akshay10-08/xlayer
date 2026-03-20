import type { MarketSnapshot, Signal } from "../../shared/src/types.js";
import { normalizeScore } from "../../shared/src/indicators.js";
import { roundTo } from "../../shared/src/deterministic.js";
import { BaseAgent } from "./agent-base.js";

export class SentimentAgent extends BaseAgent {
  readonly agentId = "sentiment" as const;
  readonly cost = 0.75;

  analyze(snapshot: MarketSnapshot): Signal {
    const score = normalizeScore(snapshot.sentimentScore * 0.85 + Math.tanh(snapshot.currentPrice / 500) * 0.05);
    const direction = score > 0.12 ? "LONG" : score < -0.12 ? "SHORT" : "NEUTRAL";
    const narrative = score >= 0
      ? "Narrative tone is constructive with mild positive momentum."
      : "Narrative tone is cooling and attention is fading.";

    return this.mintSignal(snapshot, {
      agentId: this.agentId,
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction,
      confidence: Math.min(0.88, Math.max(0.38, Math.abs(score) + 0.28)),
      reasoning: narrative,
      priceTarget: roundTo(snapshot.currentPrice * (1 + score * 0.02), 4),
      stopLoss: roundTo(snapshot.currentPrice * (1 - Math.abs(score) * 0.015), 4),
      evidence: {
        sentimentScore: roundTo(snapshot.sentimentScore, 4),
        score
      }
    });
  }
}

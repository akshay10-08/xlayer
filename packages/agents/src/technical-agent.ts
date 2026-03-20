import { averageTrueRange, computeEma, computePriceMomentum, computeRsi, computeVolatility, normalizeScore } from "../../shared/src/indicators.js";
import { roundTo } from "../../shared/src/deterministic.js";
import type { MarketSnapshot, Signal } from "../../shared/src/types.js";
import { BaseAgent } from "./agent-base.js";

export class TechnicalAgent extends BaseAgent {
  readonly agentId = "technical" as const;
  readonly cost = 1;

  analyze(snapshot: MarketSnapshot): Signal {
    const closes = snapshot.candles.map((candle) => candle.close);
    const shortEma = computeEma(closes.slice(-12), 9);
    const longEma = computeEma(closes.slice(-26), 21);
    const rsi = computeRsi(closes);
    const volatility = computeVolatility(closes.slice(-24));
    const momentum = computePriceMomentum(closes.slice(-12));
    const atr = averageTrueRange(snapshot.candles, 14);
    const trendDelta = (shortEma - longEma) / longEma;
    const breakoutStrength = (snapshot.currentPrice - (Math.max(...closes.slice(-20)))) / snapshot.currentPrice;
    const score = normalizeScore(
      trendDelta * 7 +
      ((50 - rsi) / 50) * -0.65 +
      momentum * 4 +
      breakoutStrength * 9 -
      volatility * 2
    );

    const direction = score > 0.08 ? "LONG" : score < -0.08 ? "SHORT" : "NEUTRAL";

    return this.mintSignal(snapshot, {
      agentId: this.agentId,
      symbol: snapshot.symbol,
      timeframe: snapshot.timeframe,
      direction,
      confidence: Math.min(0.96, Math.max(0.45, Math.abs(score) + 0.35)),
      reasoning: `EMA alignment is ${trendDelta >= 0 ? "bullish" : "bearish"}, RSI is ${roundTo(rsi, 2)}, and momentum is ${roundTo(momentum * 100, 2)}%.`,
      priceTarget: roundTo(snapshot.currentPrice * (1 + Math.max(trendDelta, momentum) * 1.8), 4),
      stopLoss: roundTo(snapshot.currentPrice - Math.sign(score || 1) * atr * 1.4, 4),
      evidence: {
        shortEma: roundTo(shortEma, 4),
        longEma: roundTo(longEma, 4),
        rsi: roundTo(rsi, 2),
        volatility: roundTo(volatility, 4),
        atr: roundTo(atr, 4),
        score
      }
    });
  }
}

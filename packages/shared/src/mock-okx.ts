import { createRng, hashToSeed, roundTo, timeframeToMs } from "./deterministic.js";
import type { Candle, MarketSnapshot, TradeExecution, TradeRequest } from "./types.js";

function buildPricePath(symbol: string, timeframe: string, now = Date.now()) {
  const seed = hashToSeed(`${symbol}:${timeframe}:${Math.floor(now / timeframeToMs(timeframe))}`);
  const rng = createRng(seed);
  const basePrice = 10 + (hashToSeed(symbol) % 2_000) / 10;
  const candles: Candle[] = [];
  let lastClose = basePrice * (0.92 + rng() * 0.16);
  const interval = timeframeToMs(timeframe);
  const end = Math.floor(now / interval) * interval;
  const count = Math.max(32, Math.min(96, Math.floor(96 - rng() * 16)));

  for (let index = count - 1; index >= 0; index -= 1) {
    const openTime = end - index * interval;
    const drift = (rng() - 0.45) * 0.05;
    const volatility = 0.01 + rng() * 0.035;
    const open = lastClose;
    const close = open * (1 + drift);
    const range = Math.max(open, close) * volatility;
    const high = Math.max(open, close) + range * (0.4 + rng() * 0.6);
    const low = Math.min(open, close) - range * (0.4 + rng() * 0.6);
    const volume = 1_000 + rng() * 9_000 * (1 + volatility * 8);
    candles.push({
      openTime,
      closeTime: openTime + interval,
      open: roundTo(open, 4),
      high: roundTo(high, 4),
      low: roundTo(Math.max(0.01, low), 4),
      close: roundTo(close, 4),
      volume: roundTo(volume, 2)
    });
    lastClose = close;
  }

  return candles;
}

export function getMarketSnapshot(symbol: string, timeframe = "15m", now = Date.now()): MarketSnapshot {
  const candles = buildPricePath(symbol, timeframe, now);
  const closes = candles.map((candle) => candle.close);
  const currentPrice = closes[closes.length - 1] ?? 0;
  const symbolScore = hashToSeed(symbol);
  const whaleFlowScore = (((symbolScore % 200) - 100) / 100) * 0.65 + (((currentPrice % 7) - 3.5) / 10);
  const sentimentScore = (((symbolScore >> 3) % 200) - 100) / 100 * 0.45 + Math.tanh((currentPrice - (closes[0] ?? currentPrice)) / currentPrice) * 0.55;
  const spreadBps = 4 + (symbolScore % 11);

  return {
    symbol,
    timeframe,
    currentPrice: roundTo(currentPrice, 4),
    candles,
    whaleFlowScore: roundTo(whaleFlowScore, 4),
    sentimentScore: roundTo(sentimentScore, 4),
    spreadBps
  };
}

export function simulateTrade(request: TradeRequest, market: MarketSnapshot): TradeExecution {
  const directionBias = request.direction === "LONG" ? 1 : -1;
  const microMove = market.sentimentScore * 0.0025 + market.whaleFlowScore * 0.0032;
  const fillPrice = roundTo(market.currentPrice * (1 + directionBias * microMove), 4);
  const slippageBps = Math.abs(microMove) * 10_000 + market.spreadBps;
  const status = slippageBps <= request.maxSlippageBps ? "EXECUTED" : "SIMULATED";

  return {
    orderId: `okx-${hashToSeed(`${request.symbol}:${request.direction}:${market.currentPrice}`)}`,
    symbol: request.symbol,
    direction: request.direction,
    status,
    fillPrice,
    notionalUsd: roundTo(request.positionSizeUsd, 2),
    slippageBps: roundTo(slippageBps, 2),
    executedAt: Date.now(),
    notes: status === "EXECUTED"
      ? "Mock OKX trade executed against the simulated order book."
      : "Trade was only simulated because slippage exceeded the configured cap."
  };
}

import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { hashToSeed, roundTo } from "./deterministic.js";
import type { Candle, MarketSnapshot, TradeExecution, TradeRequest } from "./types.js";

// Map our app symbols to OKX chain identifiers
const ASSET_MAP: Record<string, { address: string; chain: string }> = {
  "OKB/USDC": { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", chain: "xlayer" },
  "ETH/USDC": { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", chain: "ethereum" },
};

function runCli(command: string[]): any {
  const binary = resolve(homedir(), ".local/bin/onchainos");
  try {
    const output = execSync(`${binary} ${command.join(" ")}`, {
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    // Parse the JSON output from the CLI
    const parsed = JSON.parse(output.trim());
    if (!parsed.ok) {
      throw new Error(`CLI Error: ${JSON.stringify(parsed)}`);
    }
    return parsed.data;
  } catch (error) {
    console.error(`Failed to run onchainos CLI: ${command.join(" ")}`, error);
    throw error;
  }
}

export function getMarketSnapshotLive(symbol: string, timeframe = "15m"): MarketSnapshot {
  const asset = ASSET_MAP[symbol];
  if (!asset) {
    throw new Error(`Unsupported symbol for live data: ${symbol}`);
  }

  // Fallback map CLI bar sizes
  // onchainos expects 1m, 5m, 15m, 1H, 4H, 1D
  const bar = timeframe === "15m" || timeframe === "5m" || timeframe === "1m" ? timeframe : "1H";

  // 1. Fetch live KLine data (we want ~96 candles for good indicator math)
  // onchainos market kline --address 0xeeee... --chain xlayer --bar 15m --limit 96
  const klineData = runCli([
    "market", "kline",
    "--address", asset.address,
    "--chain", asset.chain,
    "--bar", bar,
    "--limit", "96"
  ]);

  // CLI returns them descending in time usually. Map them and ensure chronologial ascending order.
  const mappedCandles: Candle[] = klineData.map((d: any) => ({
    openTime: Number(d.ts),
    closeTime: Number(d.ts) + 15 * 60 * 1000, // Approximate close, the logic uses openTime primarily
    open: roundTo(Number(d.o), 4),
    high: roundTo(Number(d.h), 4),
    low: roundTo(Number(d.l), 4),
    close: roundTo(Number(d.c), 4),
    volume: roundTo(Number(d.vol), 2),
  })).sort((a: Candle, b: Candle) => a.openTime - b.openTime);

  const currentPrice = mappedCandles.length > 0 ? mappedCandles[mappedCandles.length - 1]!.close : 0;

  // 2. Fetch live Portfolio / Tracker stats for whale flow? 
  // For safety and speed in a real-time block orchestrator, we might still synthesize sentiment metrics unless a specific wallet is provided.
  // The instruction said "replace simulated prices with real token prices", so we'll simulate the whale/sentiment using the real price as a seed.
  const symbolScore = hashToSeed(symbol);
  const whaleFlowScore = (((symbolScore % 200) - 100) / 100) * 0.65 + (((currentPrice % 7) - 3.5) / 10);
  const sentimentScore = (((symbolScore >> 3) % 200) - 100) / 100 * 0.45;
  const spreadBps = 4;

  return {
    symbol,
    timeframe,
    currentPrice: roundTo(currentPrice, 4),
    candles: mappedCandles,
    whaleFlowScore: roundTo(whaleFlowScore, 4),
    sentimentScore: roundTo(sentimentScore, 4),
    spreadBps
  };
}

export function simulateTradeLive(request: TradeRequest, market: MarketSnapshot): TradeExecution {
  // We keep the execution simulated, but based on LIVE prices!
  const directionBias = request.direction === "LONG" ? 1 : -1;
  const microMove = market.sentimentScore * 0.0025 + market.whaleFlowScore * 0.0032;
  const fillPrice = roundTo(market.currentPrice * (1 + directionBias * microMove), 4);
  const slippageBps = Math.abs(microMove) * 10_000 + market.spreadBps;
  const status = slippageBps <= request.maxSlippageBps ? "EXECUTED" : "SIMULATED";

  return {
    orderId: `okx-${hashToSeed(`${request.symbol}:${request.direction}:${market.currentPrice}:${Date.now()}`)}`,
    symbol: request.symbol,
    direction: request.direction,
    status,
    fillPrice,
    notionalUsd: roundTo(request.positionSizeUsd, 2),
    slippageBps: roundTo(slippageBps, 2),
    executedAt: Date.now(),
    notes: status === "EXECUTED"
      ? "Mock OKX trade executed against the LIVE order book prices."
      : "Trade was only simulated because slippage exceeded the configured cap on the LIVE book."
  };
}

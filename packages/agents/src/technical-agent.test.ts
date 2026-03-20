import { describe, it, expect } from "vitest";
import { TechnicalAgent } from "./technical-agent.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";
import type { MarketSnapshot } from "../../shared/src/types.js";

describe("TechnicalAgent", () => {
  it("emits a LONG signal during strong uptrend", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new TechnicalAgent(ledger);

    // Create an artificial strong uptrend
    const candles = Array.from({ length: 30 }).map((_, i) => ({
      openTime: i * 1000,
      closeTime: i * 1000 + 999,
      open: 100 + i * 2,
      high: 105 + i * 2,
      low: 95 + i * 2,
      close: 102 + i * 2,
      volume: 1000
    }));

    const snapshot: MarketSnapshot = {
      symbol: "ETH/USDC",
      timeframe: "15m",
      currentPrice: 160,
      candles,
      whaleFlowScore: 0,
      sentimentScore: 0,
      spreadBps: 2
    };

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("LONG");
    expect(signal.confidence).toBeGreaterThan(0.5);
  });

  it("emits a SHORT signal during strong downtrend", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new TechnicalAgent(ledger);

    // Create an artificial strong downtrend
    const candles = Array.from({ length: 30 }).map((_, i) => ({
      openTime: i * 1000,
      closeTime: i * 1000 + 999,
      open: 200 - i * 2,
      high: 205 - i * 2,
      low: 195 - i * 2,
      close: 198 - i * 2,
      volume: 1000
    }));

    const snapshot: MarketSnapshot = {
      symbol: "ETH/USDC",
      timeframe: "15m",
      currentPrice: 140,
      candles,
      whaleFlowScore: 0,
      sentimentScore: 0,
      spreadBps: 2
    };

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("SHORT");
    expect(signal.confidence).toBeGreaterThan(0.5);
  });
});

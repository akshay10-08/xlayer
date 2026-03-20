import { describe, it, expect } from "vitest";
import { WhaleAgent } from "./whale-agent.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";
import type { MarketSnapshot } from "../../shared/src/types.js";

function getBaseSnapshot(): MarketSnapshot {
  return {
    symbol: "ETH/USDC",
    timeframe: "15m",
    currentPrice: 100,
    candles: [{ openTime: 0, closeTime: 1000, open: 100, high: 100, low: 100, close: 100, volume: 10000 }],
    whaleFlowScore: 0,
    sentimentScore: 0,
    spreadBps: 2
  };
}

describe("WhaleAgent", () => {
  it("emits a LONG signal when whale flow is highly positive", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new WhaleAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.whaleFlowScore = 0.8; // High positive flow

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("LONG");
  });

  it("emits a SHORT signal when whale flow is highly negative", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new WhaleAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.whaleFlowScore = -0.8; // High negative flow
    
    // Decrease the volume so it doesn't offset negative flow towards LONG
    snapshot.candles[0]!.volume = 100;

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("SHORT");
  });

  it("emits a NEUTRAL signal when whale flow is flat", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new WhaleAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.whaleFlowScore = 0.01;
    snapshot.candles[0]!.volume = 8000; // Tame volume

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("NEUTRAL");
  });
});

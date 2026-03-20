import { describe, it, expect } from "vitest";
import { SentimentAgent } from "./sentiment-agent.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";
import type { MarketSnapshot } from "../../shared/src/types.js";

function getBaseSnapshot(): MarketSnapshot {
  return {
    symbol: "ETH/USDC",
    timeframe: "15m",
    currentPrice: 100,
    candles: [],
    whaleFlowScore: 0,
    sentimentScore: 0,
    spreadBps: 2
  };
}

describe("SentimentAgent", () => {
  it("emits a LONG signal when sentiment is highly positive", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new SentimentAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.sentimentScore = 0.9; 

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("LONG");
  });

  it("emits a SHORT signal when sentiment is highly negative", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new SentimentAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.sentimentScore = -0.9;
    snapshot.currentPrice = 1;

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("SHORT");
  });

  it("emits a NEUTRAL signal when sentiment is flat", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new SentimentAgent(ledger);
    const snapshot = getBaseSnapshot();
    snapshot.sentimentScore = 0.05; // Slightly positive but below threshold
    snapshot.currentPrice = 1;

    const signal = agent.analyze(snapshot);
    expect(signal.direction).toBe("NEUTRAL");
  });
});

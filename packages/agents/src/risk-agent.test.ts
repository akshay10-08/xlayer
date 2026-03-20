import { describe, it, expect } from "vitest";
import { RiskAgent, type RiskContext } from "./risk-agent.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";
import type { ConsensusResult, MarketSnapshot } from "../../shared/src/types.js";

function getBaseSnapshot(): MarketSnapshot {
  return {
    symbol: "ETH/USDC",
    timeframe: "15m",
    currentPrice: 100,
    candles: [],
    whaleFlowScore: 0,
    sentimentScore: 0,
    fundingRate: 0,
    openInterest: 0,
    spreadBps: 2 // Adding spread for Risk test
  } as MarketSnapshot;
}

function getBaseConsensus(): ConsensusResult {
  return {
    symbol: "ETH/USDC",
    timeframe: "15m",
    direction: "LONG",
    weightedConfidence: 0.8,
    agentVotes: {},
    shouldExecute: true,
    reasoning: "Test consensus"
  };
}

function getBaseContext(): RiskContext {
  return {
    balanceUsd: 1000,
    requestedNotionalUsd: 100,
    maxPortfolioExposureUsd: 500,
    simulatedSlippageBps: 5
  };
}

describe("RiskAgent", () => {
  it("approves a safe trade", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new RiskAgent(ledger);
    const decision = agent.assess(getBaseSnapshot(), getBaseConsensus(), getBaseContext());

    expect(decision.approved).toBe(true);
    expect(decision.riskFlags).toHaveLength(0);
  });

  it("blocks a trade exceeding max portfolio exposure", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new RiskAgent(ledger);
    const context = getBaseContext();
    context.requestedNotionalUsd = 600; // Above max 500

    const decision = agent.assess(getBaseSnapshot(), getBaseConsensus(), context);

    expect(decision.approved).toBe(false);
    expect(decision.riskFlags).toContain("position_too_large");
  });

  it("blocks a trade with enormous simulated slippage", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new RiskAgent(ledger);
    const context = getBaseContext();
    context.simulatedSlippageBps = 25; // Above 18 bps limit

    const decision = agent.assess(getBaseSnapshot(), getBaseConsensus(), context);

    expect(decision.approved).toBe(false);
    expect(decision.riskFlags).toContain("high_slippage");
  });

  it("blocks a trade when consensus confidence is low and spread is wide", () => {
    const ledger = new MockX402Ledger(10);
    const agent = new RiskAgent(ledger);
    const consensus = getBaseConsensus();
    consensus.weightedConfidence = 0.3; // Below 0.56 expected
    
    const snapshot = getBaseSnapshot();
    snapshot.spreadBps = 15; // wide spread penalty = 1
    // Total risk score = 1 + 1 = 2.0 (>= 1.2)

    const decision = agent.assess(snapshot, consensus, getBaseContext());

    expect(decision.approved).toBe(false);
    expect(decision.riskFlags).toContain("low_confidence");
    expect(decision.riskFlags).toContain("wide_spread");
  });
});

import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./engine.js";

describe("Orchestrator Engine", () => {
  it("builds a complete snapshot without crashing", async () => {
    const snapshot = await buildSnapshot();

    expect(snapshot).toBeDefined();
    
    // Check root level properties
    expect(snapshot.generatedAt).toBeDefined();
    expect(snapshot.pair).toBe("OKB/USDC");
    expect(snapshot.timeframe).toBe("15m");
    
    // Check main segments
    expect(snapshot.market).toBeDefined();
    expect(snapshot.agents).toBeDefined();
    expect(snapshot.consensus).toBeDefined();
    expect(snapshot.risk).toBeDefined();
    expect(snapshot.receipts).toBeDefined();
    expect(snapshot.positions).toBeDefined();
    expect(snapshot.executionProof).toBeDefined();
    expect(snapshot.decisionSteps).toBeDefined();

    // The coordinator tests ensure agent logic works,
    // this test ensures the orchestrator's object mapping to DashboardSnapshot succeeds.
    expect(snapshot.agents.length).toBeGreaterThan(0);
    expect(snapshot.agents[0]!.payment).toBeDefined();
    expect(snapshot.decisionSteps.length).toBe(7);
  });
});

import { describe, it, expect, vi } from "vitest";
import { Coordinator } from "./coordinator.js";

describe("Coordinator", () => {
  it("runs a full multi-agent cycle and produces a round result", async () => {
    const coordinator = new Coordinator();
    const result = await coordinator.run({
      symbol: "ETH/USDC",
      timeframe: "15m",
      balanceUsd: 1000,
      requestedNotionalUsd: 100,
      maxPortfolioExposureUsd: 200
    });

    // Verify all parts of the dashboard state are produced
    expect(result.snapshot).toBeDefined();
    expect(result.signals).toHaveLength(3); // technical, whale, sentiment
    expect(result.consensus).toBeDefined();
    expect(result.risk).toBeDefined();
    expect(result.execution).toBeDefined();
    expect(result.payments).toHaveLength(3); // 3 agents were queried
  });
});

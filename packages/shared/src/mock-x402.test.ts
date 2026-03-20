import { describe, it, expect } from "vitest";
import { MockX402Ledger } from "./mock-x402.js";

describe("MockX402Ledger", () => {
  it("initializes with default balance", () => {
    const ledger = new MockX402Ledger(25);
    expect(ledger.getBalance("agent-a")).toBe(25);
  });

  it("credits an account correctly", () => {
    const ledger = new MockX402Ledger(10);
    ledger.credit("coordinator", 100);
    expect(ledger.getBalance("coordinator")).toBe(110);
  });

  it("processes a payment between two agents", () => {
    const ledger = new MockX402Ledger(10);
    // both start with 10
    const txHash = ledger.pay("technical", "whale", 5);
    
    expect(txHash).toMatch(/^x402-[0-9a-f]+$/);
    expect(ledger.getBalance("technical")).toBe(5);
    expect(ledger.getBalance("whale")).toBe(15);
  });

  it("throws an error if balance is insufficient", () => {
    const ledger = new MockX402Ledger(10);
    
    expect(() => {
      ledger.pay("sentiment", "whale", 15);
    }).toThrow(/Insufficient mock x402 balance/);

    // Balances should remain unchanged
    expect(ledger.getBalance("sentiment")).toBe(10);
    expect(ledger.getBalance("whale")).toBe(10);
  });
});

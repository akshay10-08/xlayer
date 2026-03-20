import { hashToSeed } from "./deterministic.js";

export class MockX402Ledger {
  private balances = new Map<string, number>();

  constructor(private readonly defaultBalance = 10) {}

  credit(agentId: string, amount: number) {
    const current = this.balances.get(agentId) ?? this.defaultBalance;
    this.balances.set(agentId, current + amount);
  }

  pay(from: string, to: string, amount: number) {
    const senderBalance = this.balances.get(from) ?? this.defaultBalance;
    if (senderBalance < amount) {
      throw new Error(`Insufficient mock x402 balance for ${from}`);
    }

    this.balances.set(from, senderBalance - amount);
    this.balances.set(to, (this.balances.get(to) ?? this.defaultBalance) + amount);

    const txSeed = hashToSeed(`${from}:${to}:${amount}:${senderBalance}`);
    return `x402-${txSeed}`;
  }

  getBalance(agentId: string) {
    return this.balances.get(agentId) ?? this.defaultBalance;
  }
}

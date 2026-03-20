import { hashToSeed, roundTo } from "../../shared/src/deterministic.js";
import type { AgentId, MarketSnapshot, Signal } from "../../shared/src/types.js";
import { MockX402Ledger } from "../../shared/src/mock-x402.js";

export abstract class BaseAgent {
  constructor(protected readonly ledger: MockX402Ledger) {}

  abstract readonly agentId: AgentId;
  abstract readonly cost: number;

  abstract analyze(snapshot: MarketSnapshot): Promise<Signal> | Signal;

  protected mintSignal(snapshot: MarketSnapshot, payload: Omit<Signal, "id" | "paidWith" | "createdAt" | "expiresAt">): Signal {
    const createdAt = Date.now();
    const expiresAt = createdAt + 5 * 60_000;
    const id = `signal-${hashToSeed(`${this.agentId}:${snapshot.symbol}:${createdAt}`)}`;
    const paidWith = this.ledger.pay("coordinator", this.agentId, this.cost);

    return {
      ...payload,
      id,
      paidWith,
      createdAt,
      expiresAt,
      confidence: roundTo(payload.confidence, 4)
    };
  }
}

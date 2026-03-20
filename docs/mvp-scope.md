# MVP Scope

## In scope

- Four specialist agents: technical, whale, sentiment, and risk
- One coordinator that aggregates signals and makes a consensus decision
- Shared signal schema across agents
- Mock payment flow for x402-style signal purchases
- Mock execution flow for trades and simulation
- Dashboard views for signals, consensus, risk, and trade history
- Deterministic fixtures for demo stability

## Out of scope

- Fully autonomous wallet custody
- Real money trading by default
- Complex portfolio optimization
- Advanced machine learning training pipelines
- Multiple asset classes beyond a narrow demo set
- High-frequency execution logic
- Social or community features

## Implementation priorities

1. Make the coordinator and signal schema stable.
2. Make every agent return predictable, inspectable output.
3. Make the dashboard useful for debugging and demoing.
4. Add live provider adapters only after the mock path is solid.

## Acceptance criteria

- The system can run end-to-end with no external credentials.
- Each signal includes agent identity, direction, confidence, and reasoning.
- The coordinator can produce a consensus decision from the four agent outputs.
- Risk can block an otherwise positive trade.
- The demo can be repeated with the same sample inputs and similar outputs.

## Expansion path

After the MVP is stable, the next layer should be live market data, live x402 settlement, live execution, and persistent audit storage.

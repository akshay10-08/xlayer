# ABSOLUT MVP

ABSOLUT is a mock-first, multi-agent trading intelligence MVP for X Layer. The product pairs specialist agents with a coordinator that merges their signals, applies risk checks, and prepares trades for execution.

This repository is being built in parallel, so the documentation assumes the code starts with local mocks and stubs first, then swaps in live OKX, x402, and chain integrations later.

## What lives here

- `docs/architecture.md` for the system shape and responsibilities
- `docs/setup.md` for local development setup
- `docs/env.md` for environment variables and secret handling
- `docs/mvp-scope.md` for the exact MVP boundary
- `docs/demo-flow.md` for the end-to-end demo narrative

## MVP in one sentence

Four specialist agents generate signals, the coordinator weighs them, the risk layer gates execution, and the dashboard shows the full decision trail.

## Working model

- Start with deterministic or mock data sources.
- Keep all outputs in a shared signal schema.
- Make the coordinator and dashboard observable before live trading.
- Replace mocks with live APIs one boundary at a time.

## Suggested build order

1. Shared types and mock data contracts
2. Agent modules and coordinator logic
3. Dashboard and audit trail
4. Real integrations for market data, payments, and execution

## Safety note

This MVP is a prototype and not financial advice. Any live trading behavior should remain behind explicit configuration, validation, and simulation gates.

# Architecture Overview

## Goal

Signal Swarm is a collaborative agent system that turns market context into trade decisions through a coordinator-led workflow. The MVP is designed to run safely with mock services first, while preserving clean seams for live OKX and X Layer integrations later.

## Core actors

- `Technical Agent`: interprets candles, trend, and momentum
- `Whale Agent`: watches large-flow and smart-money style signals
- `Sentiment Agent`: summarizes narrative and attention shifts
- `Risk Agent`: blocks unsafe trades and caps size or slippage
- `Coordinator`: requests signals, normalizes them, computes consensus, and decides whether to simulate or execute
- `Dashboard`: shows signals, consensus, risk decisions, and trade history

## Data flow

1. Market context is fetched from a mock data provider or future OKX APIs.
2. Each specialist agent emits a structured signal with confidence and reasoning.
3. The coordinator collects the signals and applies weighting rules.
4. The risk layer verifies exposure, slippage, and simulation status.
5. If the trade passes, the execution layer submits a mocked trade first.
6. The dashboard renders the full trail for demo and debugging purposes.

## Recommended module boundaries

- `packages/shared`: types, enums, and common helpers
- `packages/agents`: agent implementations and coordinator logic
- `packages/dashboard`: operator-facing UI and local mock views

## Mock-first integration approach

- Use local fixtures for candles, wallet state, and signal payloads.
- Keep x402 payment calls behind a service interface that can return simulated receipts.
- Keep trade execution behind a provider interface that can log actions before going live.
- Keep simulation mandatory even in mock mode so the control flow matches production.

## Future live integrations

- OKX Market API for candles, smart-money, and signal feeds
- OKX Wallet API for portfolio and exposure context
- OKX Trade API for swap execution
- OKX Onchain Gateway for simulation and preflight checks
- x402 for agent-to-agent micropayments

## Design principle

The system should be understandable from the logs alone. Every signal, score, payment stub, consensus decision, and execution attempt should be auditable and time-stamped.

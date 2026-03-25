# Signal Swarm - Raw Project Status Report

This is an honest, current-state breakdown of the codebase located in `/packages` based on real files in the repository.

## 1. Directory Structure

The project is structured as an npm workspace monorepo with the following active packages:

- **`packages/agents/`**: Core logic for specialist AI agents and the main Coordinator. Also contains the CLI runner.
- **`packages/shared/`**: Common types, math utility functions (indicators like EMA/RSI), the `live-okx.ts` wrapper for Onchain OS, and the `mock-x402.ts` ledger.
- **`packages/orchestrator/`**: Backend API layer. Exposes `engine.ts` which acts as the bridge between the multi-agent system and the dashboard frontend.
- **`packages/dashboard/`**: React/Vite web application (trading interface) styled with Tailwind and CSS files (`LandingHero.tsx`, `App.tsx`).

## 2. What Has Been Built / Coded So Far

### The Core Agent Swarm

- **`coordinator.ts`**: **Fully Functional**. Acts as the brain. Fetches the market snapshot, requests analysis from the Sentiment, Whale, and Technical agents, pays them via the mock x402 ledger, builds a weighted consensus, and then passes the proposed trade to the Risk agent before executing simulated trades.
- **`technical-agent.ts`**: **Working**. Uses actual mathematical functions to compute EMA crossovers, RSI, Momentum, and ATR on historical candle data to issue LONG/SHORT/NEUTRAL signals with calculated price targets and stop losses.
- **`whale-agent.ts`**: **Functional but Mocked Data**. Built to analyze `whaleFlowScore` and `volumeImpulse`, but currently uses a deterministic, hash-based mock logic derived from the token's current price.
- **`sentiment-agent.ts`**: **Functional but Mocked Data**. Analyzes a `sentimentScore`, but the score itself is generated via pseudo-random math (`hashToSeed`) rather than live Twitter/News APIs.
- **`risk-agent.ts`**: **Fully Functional**. It does not generate trade signals. Instead, it exposes an `assess()` function that the Coordinator calls to evaluate the trade against Hard Limits (max position size, max slippage) and Soft Limits (spread, low agent confidence, agent crowding). It either blocks or approves the trade.

### Integrations

- **`mock-x402.ts`**: **Scaffolded In-Memory Ledger**. A basic class that starts agents with default balances, deducts funds for querying, and returns string IDs like `x402-[hash]`. This is completely off-chain right now.
- **`live-okx.ts`**: **Partially Real**. It utilizes the local `onchainos` CLI to fetch actual KLine (candle) data from OKX. However, trade execution is entirely simulated here.

## 3. What is Working vs. Scaffolded/Placeholder

### Working:

- **Agent Framework & Consensus Logic**: The math to combine agent signals, weigh them, and apply risk rules is highly detailed and working correctly.
- **Technical Indicators**: The `packages/shared/src/indicators.ts` computes real TradingView-style metrics.
- **Live Market Data Fetching**: The system successfully pulls live price candles using the Onchain OS cli.

### Scaffolded / Placeholder:

- **x402 Payments**: Completely simulated using local hash maps. No actual on-chain transaction or real crypto changes hands.
- **Whale & Sentiment Feeds**: Driven by mock math formulas on live prices (`Math.tanh(currentPrice)`), not external API pipelines.
- **Trade Execution**: Generates simulated TxHashes and mocked fills. It does not route to the OKX DEX via the Onchain OS Trade API.

## 4. x402 Inter-Agent Payment Flow Implementation

**Partially implemented (Mocked Only).** The `Coordinator` currently utilizes a `MockX402Ledger` instance. When `run()` is executed, it calculates dynamic agent costs (e.g. Technical=1.0, Whale=1.5), deducts those balances via an in-memory Map, and returns a dummy transaction ID (`x402-[seed]`). No real web3 wallets, signatures, or smart contract interactions exist for x402 yet.

## 5. Connected Onchain OS APIs

1.  **Market API**: **CONNECTED.** Implemented in `live-okx.ts` via the command `onchainos market kline`. This pulls live 1m/5m/15m/1H bars from OKX into the `MarketSnapshot` for the Technical Agent to process.
2.  **Trade / Swap API**: **NOT CONNECTED.** The `simulateTradeLive` function calculates simulated slippage and fill prices based on the live market spread, but it never dispatches an on-chain transaction.
3.  **Wallet / Portfolio API**: **NOT CONNECTED.** Balance logic is fully simulated or hardcoded (`balanceUsd: 1000`) in `packages/orchestrator/src/engine.ts`.

## 6. Current Entry Point

The system is designed to be run in multiple ways, outlined in the root `package.json` scripts:

1.  **CLI Runner**: `npm run dev` or `npm run demo` executes `packages/agents/src/cli.ts` (Starts the core agent logic directly in the terminal).
2.  **API Backend**: `npm run dev:orchestrator` starts `packages/orchestrator/src/index.ts`. This serves an API endpoint (that internally calls `buildSnapshot()` in `engine.ts`) to provide the multi-agent results to the frontend.
3.  **Frontend Dashboard**: `npm run dev:dashboard` serves the Vite/React UI under `packages/dashboard`.

## 7. What is NOT Done Yet (Incomplete)

1.  **Real On-Chain Execution**: Swapping out the simulated `simulateTradeLive()` for the actual Onchain OS Swap API.
2.  **Real x402 Machine-to-Machine Payments**: Transitioning `MockX402Ledger` to real smart-contract interactions or agentic wallets.
3.  **Third-Party Data Integration**: Replacing the hash-based math in `sentiment-agent.ts` and `whale-agent.ts` with real sentiment or blockchain scanner metrics.
4.  **Wallet Management**: Implementing actual user/agent balance tracking instead of hardcoded numbers in the orchestrator pipeline.

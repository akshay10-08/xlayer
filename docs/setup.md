# Setup Guide

## Prerequisites

- Node.js 20 or newer
- A package manager such as `pnpm`
- Redis only if the backend eventually uses a live bus instead of in-memory mocks
- Supabase only if the dashboard or persistence layer is connected to live services

## Local development pattern

The MVP should run in three layers:

1. Shared contracts and mock services
2. Agent and coordinator logic
3. Dashboard and demo surface

Keep the first run dependency-light so the project can be demoed without API keys.

## Expected startup flow

1. Install dependencies.
2. Create a local env file from the template guidance in `docs/env.md`.
3. Start the backend or mock coordinator.
4. Start the dashboard.
5. Open the dashboard and trigger a sample analysis.

## Mock-first development rules

- If a live API key is missing, fall back to mock data.
- If trade execution is unavailable, log the intended execution instead of failing silently.
- If an agent cannot fetch live context, return a deterministic mock signal.
- If a payment flow is unavailable, produce a simulated receipt object.

## Developer checklist

- Confirm the shared signal schema before wiring UI state.
- Verify the coordinator can run end-to-end without external credentials.
- Keep demo fixtures deterministic so screenshots and recordings are repeatable.
- Add live integrations only after the mock path is stable.

# Environment Variables

This project is designed to work in mock mode first. Treat every variable below as optional unless the code explicitly requires it for a live integration.

## Core runtime

- `NODE_ENV`: standard Node environment setting
- `APP_ENV`: local, staging, or production label used by the app
- `LOG_LEVEL`: info, debug, warn, or error

## Mock-first defaults

- `USE_MOCKS=true`: enables local fixtures and simulated services
- `MOCK_DATA_SEED=signal-swarm-demo`: keeps demo outputs stable
- `MOCK_EXECUTION=true`: logs execution instead of submitting real trades
- `MOCK_PAYMENTS=true`: simulates x402 payment receipts

## Future live integrations

- `OKX_API_KEY`
- `OKX_API_SECRET`
- `OKX_API_PASSPHRASE`
- `OKX_MARKET_BASE_URL`
- `OKX_TRADE_BASE_URL`
- `OKX_WALLET_BASE_URL`
- `OKX_GATEWAY_BASE_URL`
- `X402_FACILITATOR_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `REDIS_URL`

## Guidance

- Keep live credentials out of source control.
- Prefer separate env files for local, demo, and production modes.
- Default to mock flags in local development so the repository stays runnable without secrets.
- Add new variables only when a concrete module consumes them.

## Suggested local template

```bash
NODE_ENV=development
APP_ENV=local
LOG_LEVEL=debug
USE_MOCKS=true
MOCK_DATA_SEED=signal-swarm-demo
MOCK_EXECUTION=true
MOCK_PAYMENTS=true
```

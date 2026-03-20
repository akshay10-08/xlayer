# Demo Flow

## Demo story

The demo should feel like a trading desk where a team of specialist agents debates a market setup, a coordinator decides whether the setup is tradable, and the dashboard shows exactly why the system acted or stood down.

## Walkthrough

1. Open the dashboard on a selected symbol.
2. Trigger a fresh analysis cycle.
3. Show the technical, whale, sentiment, and risk agents generating signals.
4. Show the coordinator merging those signals into a weighted decision.
5. Show the risk gate approving or blocking the action.
6. Show the simulated x402 payment receipt if the flow uses paid signals.
7. Show the simulated preflight and execution step.
8. Show the final trade audit record in the dashboard.

## Suggested narration

- “Each specialist sees the market differently.”
- “The coordinator pays for and collects those signals.”
- “Risk is the last gate before any action.”
- “Everything is auditable, and the mock mode keeps the demo safe.”

## Good demo inputs

- A symbol with clear trend behavior
- A deterministic fixture with one bullish and one cautious agent
- A trade setup that passes consensus but fails risk once, so the block path is visible

## Demo success criteria

- The audience can follow the decision chain without reading code.
- The mock flow looks realistic enough to replace with live services later.
- The dashboard clearly distinguishes signal generation, consensus, risk, and execution.

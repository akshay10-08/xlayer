import { Coordinator } from "./coordinator.js";

function parseArgs(argv: string[]) {
  const [symbolArg, timeframeArg, balanceArg] = argv;
  return {
    symbol: symbolArg ?? "ETH/USDC",
    timeframe: timeframeArg ?? "15m",
    balanceUsd: balanceArg ? Number(balanceArg) : 250
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const coordinator = new Coordinator();
  const result = await coordinator.run(args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

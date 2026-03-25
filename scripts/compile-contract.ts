/**
 * compile-contract.ts
 * Compiles SignalRegistry.sol using solc directly (works on Node 20).
 * Outputs artifact to artifacts/SignalRegistry.json (same format as hardhat).
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import solc from "solc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(__dirname, "../contracts/SignalRegistry.sol");
const outDir = path.join(__dirname, "../artifacts");

const source = fs.readFileSync(contractPath, "utf-8");

const input = {
  language: "Solidity",
  sources: { "SignalRegistry.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
  },
};

console.log("🔨 Compiling SignalRegistry.sol...");
const output = JSON.parse(solc.compile(JSON.stringify(input))) as {
  errors?: { severity: string; formattedMessage: string }[];
  contracts: { "SignalRegistry.sol": { SignalRegistry: { abi: object[]; evm: { bytecode: { object: string } } } } };
};

const errors = output.errors?.filter(e => e.severity === "error") ?? [];
if (errors.length > 0) {
  console.error("❌ Compilation errors:");
  errors.forEach(e => console.error(e.formattedMessage));
  process.exit(1);
}

const contract = output.contracts["SignalRegistry.sol"]!["SignalRegistry"]!;
const artifact = {
  contractName: "SignalRegistry",
  abi: contract.abi,
  bytecode: "0x" + contract.evm.bytecode.object,
};

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "SignalRegistry.json"), JSON.stringify(artifact, null, 2));

console.log("✅ Compiled! Artifact written to artifacts/SignalRegistry.json");
console.log(`   ABI entries: ${artifact.abi.length}`);
console.log(`   Bytecode size: ${(artifact.bytecode.length / 2).toFixed(0)} bytes`);
console.log("\n📋 Run next: DEPLOYER_PRIVATE_KEY=0x... npm run deploy:registry");

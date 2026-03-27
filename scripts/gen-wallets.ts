/**
 * gen-wallets.ts
 * Generates 3 fresh Ethereum wallets for the 3 agent servers.
 * Copy the output into packages/shared/.env
 */
import { ethers } from "ethers";

function gen(name: string) {
  const w = ethers.Wallet.createRandom();
  console.log(`\n## ${name}`);
  console.log(`Address:     ${w.address}`);
  console.log(`Private Key: ${w.privateKey}`);
  console.log(`Mnemonic:    ${w.mnemonic?.phrase}`);
  return w;
}

console.log("═══════════════════════════════════════════════");
console.log("    ABSOLUT — Agent Wallet Generator");
console.log("═══════════════════════════════════════════════");

const tech = gen("Technical Agent Wallet");
const whale = gen("Whale Agent Wallet");
const sent = gen("Sentiment Agent Wallet");

console.log(`\n\n# ── Copy these into packages/shared/.env ──────────`);
console.log(`TECHNICAL_AGENT_WALLET=${tech.address}`);
console.log(`WHALE_AGENT_WALLET=${whale.address}`);
console.log(`SENTIMENT_AGENT_WALLET=${sent.address}`);
console.log(`\n# ── ONE coordinator key (also fund this with OKB+USDC) ──`);
const coord = ethers.Wallet.createRandom();
console.log(`COORDINATOR_KEY=${coord.privateKey}`);
console.log(`# coordinator address: ${coord.address}`);

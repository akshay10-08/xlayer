/**
 * deploy-contracts.mjs
 * ESM-compatible: Compiles MockUSDC + SignalRegistry using solc,
 * deploys both to X Layer Testnet, generates agent wallets,
 * mints 500 USDC, auto-appends to root .env
 */
import { createRequire } from "module";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const solc = require("solc");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env manually (no dotenv ESM issues) ────────────────────────────────
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1 || line.startsWith("#")) continue;
  const k = line.slice(0, eqIdx).trim();
  const v = line.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
  if (k && !process.env[k]) process.env[k] = v;
}

const RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;

if (!COORDINATOR_KEY) {
  console.error("❌  COORDINATOR_KEY not set in .env");
  process.exit(1);
}

// ─── Compile helper ───────────────────────────────────────────────────────────
function compile(name, source) {
  const input = {
    language: "Solidity",
    sources: { [`${name}.sol`]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } 
    },
  };
  const raw = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (raw.errors ?? []).filter(e => e.severity === "error");
  if (errors.length) { console.error("Compile errors:", errors); process.exit(1); }
  const contract = raw.contracts[`${name}.sol`][name];
  return { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const contractsDir = path.resolve(__dirname, "../contracts");

async function main() {
  console.log("\n─────────────────────────────────────────────");
  console.log("  ABSOLUT — X Layer Testnet Setup");
  console.log("─────────────────────────────────────────────\n");

  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(COORDINATOR_KEY, provider);
  const network  = await provider.getNetwork();
  const balance  = await provider.getBalance(deployer.address);

  console.log(`📍 Deployer address : ${deployer.address}`);
  console.log(`🌐 Network          : chainId ${network.chainId}`);
  console.log(`💎 OKB Balance      : ${ethers.formatEther(balance)} OKB\n`);

  if (balance === 0n) {
    console.error("❌  Deployer has 0 OKB — fund from https://okx.com/xlayer/faucet");
    process.exit(1);
  }

  // ─── Deterministic agent wallets from coordinator key ─────────────────────
  // Derive 3 child wallets deterministically using hash-based seeds
  const makeAgentWallet = (index) => {
    const agentSeed = ethers.keccak256(ethers.concat([
      ethers.toUtf8Bytes("absolut-agent-"),
      ethers.toUtf8Bytes(String(index)),
      ethers.getBytes(COORDINATOR_KEY),
    ]));
    return new ethers.Wallet(agentSeed).address;
  };
  const agents = {
    technical: makeAgentWallet(0),
    whale:     makeAgentWallet(1),
    sentiment: makeAgentWallet(2),
  };

  console.log("👾 Agent wallet addresses:");
  console.log(`   technical : ${agents.technical}`);
  console.log(`   whale     : ${agents.whale}`);
  console.log(`   sentiment : ${agents.sentiment}\n`);

  // ─── Compile contracts ────────────────────────────────────────────────────
  console.log("🔨 Compiling contracts...");
  const usdcSrc  = fs.readFileSync(path.join(contractsDir, "MockUSDC.sol"), "utf8");
  const regSrc   = fs.readFileSync(path.join(contractsDir, "SignalRegistry.sol"), "utf8");
  const journalSrc = fs.readFileSync(path.join(contractsDir, "TradeJournal.sol"), "utf8");
  const portfolioSrc = fs.readFileSync(path.join(contractsDir, "PortfolioReport.sol"), "utf8");
  const usdc     = compile("MockUSDC", usdcSrc);
  const registry = compile("SignalRegistry", regSrc);
  const journal  = compile("TradeJournal", journalSrc);
  const portfolio = compile("PortfolioReport", portfolioSrc);
  console.log("✅ Compilation successful\n");

  // ─── Deploy MockUSDC ──────────────────────────────────────────────────────
  console.log("🚀 Deploying MockUSDC...");
  const usdcFactory   = new ethers.ContractFactory(usdc.abi, usdc.bytecode, deployer);
  const usdcContract  = await usdcFactory.deploy();
  await usdcContract.waitForDeployment();
  const usdcAddress   = await usdcContract.getAddress();
  const usdcDeployTx  = usdcContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ MockUSDC          : ${usdcAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${usdcDeployTx}\n`);

  // ─── Deploy SignalRegistry ────────────────────────────────────────────────
  console.log("🚀 Deploying SignalRegistry...");
  const regFactory  = new ethers.ContractFactory(registry.abi, registry.bytecode, deployer);
  const regContract = await regFactory.deploy();
  await regContract.waitForDeployment();
  const regAddress  = await regContract.getAddress();
  const regDeployTx = regContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ SignalRegistry     : ${regAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${regDeployTx}\n`);

  // ─── Deploy TradeJournal ────────────────────────────────────────────────
  console.log("🚀 Deploying TradeJournal...");
  const journalFactory  = new ethers.ContractFactory(journal.abi, journal.bytecode, deployer);
  const journalContract = await journalFactory.deploy();
  await journalContract.waitForDeployment();
  const journalAddress  = await journalContract.getAddress();
  const journalDeployTx = journalContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ TradeJournal       : ${journalAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${journalDeployTx}\n`);

  // ─── Deploy PortfolioReport ────────────────────────────────────────────────
  console.log("🚀 Deploying PortfolioReport...");
  const portfolioFactory  = new ethers.ContractFactory(portfolio.abi, portfolio.bytecode, deployer);
  const portfolioContract = await portfolioFactory.deploy();
  await portfolioContract.waitForDeployment();
  const portfolioAddress  = await portfolioContract.getAddress();
  const portfolioDeployTx = portfolioContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ PortfolioReport    : ${portfolioAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${portfolioDeployTx}\n`);

  // ─── Mint 500 USDC to coordinator ────────────────────────────────────────
  console.log("💸 Minting 500 USDC to coordinator...");
  const usdcAbi = ["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)"];
  const usdcW   = new ethers.Contract(usdcAddress, usdcAbi, deployer);
  const mintTx  = await usdcW.mint(deployer.address, ethers.parseUnits("500", 6));
  const mintRec = await mintTx.wait();
  const bal     = await usdcW.balanceOf(deployer.address);
  console.log(`✅ Minted 500 USDC`);
  console.log(`   Coordinator balance : ${ethers.formatUnits(bal, 6)} USDC`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${mintRec.hash}\n`);

  // ─── Update .env ─────────────────────────────────────────────────────────
  const block = [
    "",
    "# ── Deployed by deploy-contracts.mjs ──────────────────",
    `XLAYER_USDC_ADDRESS=${usdcAddress}`,
    `SIGNAL_REGISTRY_ADDRESS=${regAddress}`,
    `TRADE_JOURNAL_ADDRESS=${journalAddress}`,
    `PORTFOLIO_REPORT_ADDRESS=${portfolioAddress}`,
    `TECHNICAL_AGENT_WALLET=${agents.technical}`,
    `WHALE_AGENT_WALLET=${agents.whale}`,
    `SENTIMENT_AGENT_WALLET=${agents.sentiment}`,
  ].join("\n") + "\n";

  fs.appendFileSync(envPath, block);

  console.log("─────────────────────────────────────────────");
  console.log("  ✅ .env updated with:");
  console.log("─────────────────────────────────────────────");
  console.log(block);
  console.log("🎉 DONE — x402 payments will now be REAL transactions on X Layer Testnet!");
  console.log(`\n   Explorer: https://www.oklink.com/xlayer-test/address/${usdcAddress}`);
}

main().catch(e => { console.error("❌ Deploy failed:", e?.message ?? e); process.exit(1); });

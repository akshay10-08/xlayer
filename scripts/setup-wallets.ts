/**
 * deploy-contracts.ts
 * Compiles MockUSDC + SignalRegistry using solc,
 * deploys both to X Layer Testnet,
 * generates 3 deterministic agent wallets,
 * mints 500 USDC to coordinator,
 * and auto-appends all values to root .env
 */
// @ts-nocheck
const solc = require("solc");
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

// Load dotenv manually
const envPath = path.resolve(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#") && !process.env[k.trim()]) {
    process.env[k.trim()] = v.join("=").replace(/^"|"$/g, "").trim();
  }
}

const RPC = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const COORDINATOR_KEY = process.env.COORDINATOR_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;

if (!COORDINATOR_KEY) { console.error("❌ COORDINATOR_KEY not set"); process.exit(1); }

// ─── Read contract sources ─────────────────────────────────────────────────────
const contractsDir = path.resolve(__dirname, "../contracts");
const usdcSrc = fs.readFileSync(path.join(contractsDir, "MockUSDC.sol"), "utf8");
const registrySrc = fs.readFileSync(path.join(contractsDir, "SignalRegistry.sol"), "utf8");

function compile(name: string, source: string) {
  const input = {
    language: "Solidity",
    sources: { [`${name}.sol`]: { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some((e: any) => e.severity === "error")) {
    console.error("Compile errors:", output.errors);
    process.exit(1);
  }
  const contract = output.contracts[`${name}.sol`][name];
  return { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };
}

async function main() {
  console.log("─────────────────────────────────────────────");
  console.log("  Signal Swarm — X Layer Testnet Setup");
  console.log("─────────────────────────────────────────────\n");

  // Connect
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(COORDINATOR_KEY, provider);
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(deployer.address);

  console.log(`📍 Deployer address : ${deployer.address}`);
  console.log(`🌐 Network          : chainId ${network.chainId}`);
  console.log(`💎 OKB Balance      : ${ethers.formatEther(balance)} OKB\n`);

  if (balance === 0n) {
    console.error("❌ No OKB — fund from https://www.okx.com/xlayer/faucet");
    process.exit(1);
  }

  // ─── Agent wallets (deterministic from coordinator key) ───────────────────
  const seed = ethers.keccak256(ethers.toUtf8Bytes("signal-swarm-agents-" + deployer.address));
  const masterNode = ethers.HDNodeWallet.fromPhrase(
    ethers.Mnemonic.entropyToPhrase(ethers.getBytes(seed))
  );
  const agents = {
    technical: masterNode.derivePath("m/44'/60'/0'/0/0").address,
    whale:     masterNode.derivePath("m/44'/60'/0'/0/1").address,
    sentiment: masterNode.derivePath("m/44'/60'/0'/0/2").address,
  };

  console.log("👾 Agent wallet addresses:");
  console.log(`   technical : ${agents.technical}`);
  console.log(`   whale     : ${agents.whale}`);
  console.log(`   sentiment : ${agents.sentiment}\n`);

  // ─── Compile ───────────────────────────────────────────────────────────────
  console.log("🔨 Compiling MockUSDC...");
  const usdc = compile("MockUSDC", usdcSrc);
  console.log("🔨 Compiling SignalRegistry...");
  const registry = compile("SignalRegistry", registrySrc);
  console.log("✅ Compilation successful\n");

  // ─── Deploy MockUSDC ───────────────────────────────────────────────────────
  console.log("🚀 Deploying MockUSDC...");
  const usdcFactory = new ethers.ContractFactory(usdc.abi, usdc.bytecode, deployer);
  const usdcContract = await usdcFactory.deploy();
  await usdcContract.waitForDeployment();
  const usdcAddress = await usdcContract.getAddress();
  const usdcDeployTx = usdcContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ MockUSDC deployed  : ${usdcAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${usdcDeployTx}\n`);

  // ─── Deploy SignalRegistry ─────────────────────────────────────────────────
  console.log("🚀 Deploying SignalRegistry...");
  const regFactory = new ethers.ContractFactory(registry.abi, registry.bytecode, deployer);
  const regContract = await regFactory.deploy();
  await regContract.waitForDeployment();
  const regAddress = await regContract.getAddress();
  const regDeployTx = regContract.deploymentTransaction()?.hash ?? "";
  console.log(`✅ SignalRegistry deployed : ${regAddress}`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${regDeployTx}\n`);

  // ─── Mint 500 USDC to coordinator ─────────────────────────────────────────
  console.log("💸 Minting 500 USDC to coordinator...");
  const mintAbi = ["function mint(address to, uint256 amount) external", "function balanceOf(address) view returns (uint256)"];
  const usdcW = new ethers.Contract(usdcAddress, mintAbi, deployer);
  const mintTx = await usdcW.mint(deployer.address, ethers.parseUnits("500", 6));
  const mintReceipt = await mintTx.wait();
  const bal = await usdcW.balanceOf(deployer.address);
  console.log(`✅ Minted 500 USDC`);
  console.log(`   Coordinator balance : ${ethers.formatUnits(bal, 6)} USDC`);
  console.log(`   TX: https://www.oklink.com/xlayer-test/tx/${mintReceipt.hash}\n`);

  // ─── Write to .env ─────────────────────────────────────────────────────────
  const envBlock = [
    "",
    "# ── Deployed by deploy-contracts.ts ──",
    `XLAYER_USDC_ADDRESS=${usdcAddress}`,
    `SIGNAL_REGISTRY_ADDRESS=${regAddress}`,
    `TECHNICAL_AGENT_WALLET=${agents.technical}`,
    `WHALE_AGENT_WALLET=${agents.whale}`,
    `SENTIMENT_AGENT_WALLET=${agents.sentiment}`,
  ].join("\n");

  fs.appendFileSync(envPath, envBlock + "\n");

  console.log("─────────────────────────────────────────────");
  console.log("  ✅ .env updated with the following values:");
  console.log("─────────────────────────────────────────────");
  console.log(envBlock);
  console.log("\n🎉 Setup complete! x402 payments are now REAL.\n");
  console.log("   Explorer: https://www.oklink.com/xlayer-test");
  console.log(`   MockUSDC: https://www.oklink.com/xlayer-test/address/${usdcAddress}`);
  console.log(`   Registry: https://www.oklink.com/xlayer-test/address/${regAddress}`);
}

main().catch((e) => { console.error("❌ Deploy failed:", e.message ?? e); process.exit(1); });

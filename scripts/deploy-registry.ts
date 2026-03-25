import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC       = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const CHAIN_ID  = 195;
const PRIV_KEY  = process.env.DEPLOYER_PRIVATE_KEY;

if (!PRIV_KEY) {
  console.error("❌ Set DEPLOYER_PRIVATE_KEY in packages/shared/.env");
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(PRIV_KEY!, provider);

  console.log("Deployer:  ", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:   ", ethers.formatEther(balance), "OKB");

  if (balance === 0n) {
    console.error("❌ Wallet has no testnet OKB. Go to https://www.okx.com/xlayer/faucet");
    process.exit(1);
  }

  // Load compiled artifact (we use hardhat to compile, then remix this)
  const artifactPath = path.join(__dirname, "../artifacts/contracts/SignalRegistry.sol/SignalRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8")) as { abi: object[]; bytecode: string };
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("\n🚀 Deploying SignalRegistry to X Layer Testnet...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address   = await contract.getAddress();
  const deployTx  = contract.deploymentTransaction()!.hash;
  const explorer  = `https://www.oklink.com/xlayer-test/tx/${deployTx}`;

  console.log("\n✅ Contract deployed:", address);
  console.log("✅ TX hash:          ", deployTx);
  console.log("🔗 Explorer:         ", explorer);

  // Save for frontend / orchestrator
  const output = { SignalRegistry: address, deployTx, network: "X Layer Testnet", chainId: CHAIN_ID };
  fs.writeFileSync(path.join(__dirname, "../../contract-address.json"), JSON.stringify(output, null, 2));

  console.log("\n📋 NEXT STEP: add this to packages/shared/.env:");
  console.log(`SIGNAL_REGISTRY_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

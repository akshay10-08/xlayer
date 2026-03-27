import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../packages/shared/.env") });

const RPC      = process.env.XLAYER_TESTNET_RPC ?? "https://testrpc.xlayer.tech";
const CHAIN_ID = 195;
const PRIV_KEY = process.env.DEPLOYER_PRIVATE_KEY;

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

  // Load compiled artifact
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json"
  );

  if (!fs.existsSync(artifactPath)) {
    console.error("❌ Artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }

  const artifact = JSON.parse(
    fs.readFileSync(artifactPath, "utf-8")
  ) as { abi: object[]; bytecode: string };

  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("\n🚀 Deploying AgentRegistry to X Layer Testnet...");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address  = await contract.getAddress();
  const deployTx = contract.deploymentTransaction()!.hash;
  const explorer = `https://www.oklink.com/xlayer-test/tx/${deployTx}`;

  console.log("\n✅ AgentRegistry deployed:", address);
  console.log("✅ TX hash:               ", deployTx);
  console.log("🔗 OKLink explorer:       ", explorer);
  console.log("\n📋 Add to packages/shared/.env (and root .env):");
  console.log(`AGENT_REGISTRY_ADDRESS=${address}`);

  // Patch the root .env
  const rootEnvPath = path.join(__dirname, "../.env");
  if (fs.existsSync(rootEnvPath)) {
    let rootEnv = fs.readFileSync(rootEnvPath, "utf-8");
    if (rootEnv.includes("AGENT_REGISTRY_ADDRESS=")) {
      rootEnv = rootEnv.replace(
        /AGENT_REGISTRY_ADDRESS=.*/,
        `AGENT_REGISTRY_ADDRESS=${address}`
      );
    } else {
      rootEnv += `\nAGENT_REGISTRY_ADDRESS=${address}\n`;
    }
    fs.writeFileSync(rootEnvPath, rootEnv);
    console.log("✅ Root .env updated with AGENT_REGISTRY_ADDRESS");
  }

  // Patch packages/shared/.env
  const sharedEnvPath = path.join(__dirname, "../packages/shared/.env");
  if (fs.existsSync(sharedEnvPath)) {
    let sharedEnv = fs.readFileSync(sharedEnvPath, "utf-8");
    if (sharedEnv.includes("AGENT_REGISTRY_ADDRESS=")) {
      sharedEnv = sharedEnv.replace(
        /AGENT_REGISTRY_ADDRESS=.*/,
        `AGENT_REGISTRY_ADDRESS=${address}`
      );
    } else {
      sharedEnv += `\nAGENT_REGISTRY_ADDRESS=${address}\n`;
    }
    fs.writeFileSync(sharedEnvPath, sharedEnv);
    console.log("✅ packages/shared/.env updated with AGENT_REGISTRY_ADDRESS");
  }

  // Save deployment record
  const output = {
    AgentRegistry: address,
    deployTx,
    network: "X Layer Testnet",
    chainId: CHAIN_ID,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(__dirname, "../artifacts/agent-registry-deployment.json"),
    JSON.stringify(output, null, 2)
  );
  console.log("📁 Saved: artifacts/agent-registry-deployment.json");
}

main().catch((e) => { console.error(e); process.exit(1); });

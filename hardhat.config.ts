import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
dotenv.config({ path: "./packages/shared/.env" });

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    xlayerTestnet: {
      type: "http",
      url: "https://testrpc.xlayer.tech",
      chainId: 195,
      accounts: [PRIVATE_KEY],
    },
    xlayerMainnet: {
      type: "http",
      url: "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;

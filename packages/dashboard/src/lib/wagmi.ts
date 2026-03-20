import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";

/**
 * X Layer Mainnet (chain ID 196)
 * https://www.okx.com/xlayer/docs/developer/build-on-xlayer/network-information
 */
export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: {
    decimals: 18,
    name: "OKB",
    symbol: "OKB",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.xlayer.tech"],
    },
    public: {
      http: ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKLink",
      url: "https://www.oklink.com/xlayer",
    },
  },
  contracts: {},
});

/**
 * X Layer Testnet (chain ID 195)
 */
export const xlayerTestnet = defineChain({
  id: 195,
  name: "X Layer Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "OKB",
    symbol: "OKB",
  },
  rpcUrls: {
    default: {
      http: ["https://testrpc.xlayer.tech"],
    },
    public: {
      http: ["https://testrpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "OKLink Testnet",
      url: "https://www.oklink.com/xlayer-test",
    },
  },
  testnet: true,
  contracts: {},
});

// WalletConnect project ID — get a free one at https://cloud.walletconnect.com
// Falls back gracefully for injected wallets (MetaMask, etc.) if not provided.
const WC_PROJECT_ID =
  (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ?? "signal-swarm-demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Signal Swarm",
  projectId: WC_PROJECT_ID,
  chains: [xlayer, xlayerTestnet, mainnet, sepolia],
  ssr: false,
});

export const XLAYER_CHAIN_ID = xlayer.id;
export const XLAYER_TESTNET_CHAIN_ID = xlayerTestnet.id;

import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
    process.env.XLAYER_TESTNET_RPC!
);

// Tokens we can analyze — must have OKX Market API pairs
const KNOWN_TOKENS: Record<string, {
    address: string;
    symbol: string;
    decimals: number;
    okxPair: string | null;
}> = {
    "OKB":  { address: "native",                                    symbol: "OKB",  decimals: 18, okxPair: "OKB/USDC" },
    "USDC": { address: process.env.XLAYER_USDC_ADDRESS ?? "",       symbol: "USDC", decimals: 6,  okxPair: null },
    "ETH":  { address: "0xbec7859bc3d0603bec454f7194173e36bf2aa5c8", symbol: "ETH",  decimals: 18, okxPair: "ETH/USDC" },
};

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

export interface WalletToken {
    symbol: string;
    pair: string;
    balance: number;
    rawBalance: bigint;
    decimals: number;
    estimatedValueUSDC: number;
}

export async function readWalletTokens(
    walletAddress: string,
    currentPrices: Record<string, number>
): Promise<WalletToken[]> {

    const tokens: WalletToken[] = [];

    for (const [symbol, info] of Object.entries(KNOWN_TOKENS)) {
        // Skip stablecoins — no pair to analyze
        if (!info.okxPair) continue;

        let rawBalance = BigInt(0);
        try {
            if (info.address === "native") {
                rawBalance = await provider.getBalance(walletAddress);
            } else if (info.address) {
                const contract = new ethers.Contract(info.address, ERC20_ABI, provider) as any;
                rawBalance = await contract.balanceOf(walletAddress) as bigint;
            }
        } catch (e) {
            console.warn(`Could not read ${symbol} balance:`, (e as Error).message);
            continue;
        }

        const balance = Number(ethers.formatUnits(rawBalance, info.decimals));
        const price = currentPrices[symbol] ?? 0;
        const valueUSDC = balance * price;

        // Skip dust positions < $0.50
        if (valueUSDC < 0.50) continue;

        tokens.push({
            symbol,
            pair: info.okxPair,
            balance,
            rawBalance,
            decimals: info.decimals,
            estimatedValueUSDC: valueUSDC,
        });
    }

    return tokens.sort((a, b) => b.estimatedValueUSDC - a.estimatedValueUSDC);
}

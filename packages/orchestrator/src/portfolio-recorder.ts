import { ethers } from "ethers";

// Human-readable ABI for PortfolioReport
const portfolioReportAbi = [
    "function saveReport(uint256 totalValueUSDC, uint8 overallHealth, string healthLabel, string[] symbols, string[] pairs, uint256[] balances, uint256[] valuesUSDC, uint8[] verdicts, uint8[] confidences, string[] reasonings, uint8[] weights) external returns (uint256)",
    "function getUserReports(address user) external view returns (uint256[])",
    "function getReport(uint256 id) external view returns (address wallet, uint256 totalValueUSDC, uint8 overallHealth, string healthLabel, uint256 sellCount, uint256 holdCount, uint256 addCount, uint256 createdAt, uint256 tokenCount)",
    "function getReportToken(uint256 reportId, uint256 tokenIndex) external view returns (tuple(string symbol, string pair, uint256 balance, uint256 valueUSDC, uint8 verdict, uint8 confidence, string reasoning, uint8 portfolioWeight))",
    "event ReportGenerated(uint256 indexed reportId, address indexed wallet, uint256 totalValueUSDC, uint8 overallHealth, uint256 tokenCount)"
];

// Inline type to avoid circular imports
interface TokenReport {
    symbol: string; pair: string; balance: number; valueUSDC: number;
    portfolioWeight: number; verdict: "HOLD" | "SELL" | "ADD";
    confidence: number; reasoning: string;
    agentSignals: { technical: string; whale: string; sentiment: string };
    x402Payments: { technical: string; whale: string; sentiment: string };
}

export async function recordPortfolioOnchain(
    _walletAddress: string,
    tokens: TokenReport[],
    totalValueUSDC: number,
    healthScore: number,
    healthLabel: string
): Promise<string> {

    const provider = new ethers.JsonRpcProvider(process.env.XLAYER_TESTNET_RPC!);
    const signer = new ethers.Wallet(process.env.COORDINATOR_KEY!, provider);
    const contract = new ethers.Contract(
        process.env.PORTFOLIO_REPORT_ADDRESS!,
        portfolioReportAbi,
        signer
    ) as any;

    const verdictMap: Record<string, number> = { "HOLD": 0, "SELL": 1, "ADD": 2 };

    const tx = await contract.saveReport(
        BigInt(Math.round(totalValueUSDC * 1e6)),
        healthScore,
        healthLabel,
        tokens.map(t => t.symbol),
        tokens.map(t => t.pair),
        tokens.map(t => BigInt(Math.round(t.balance * 1e6))),
        tokens.map(t => BigInt(Math.round(t.valueUSDC * 1e6))),
        tokens.map(t => verdictMap[t.verdict] ?? 0),
        tokens.map(t => t.confidence),
        tokens.map(t => t.reasoning),
        tokens.map(t => t.portfolioWeight)
    );

    const receipt = await tx.wait();
    console.log("Portfolio recorded onchain:", receipt.hash);
    return receipt.hash;
}

export async function getUserPortfolioReports(walletAddress: string) {
    const provider = new ethers.JsonRpcProvider(process.env.XLAYER_TESTNET_RPC!);
    const contract = new ethers.Contract(
        process.env.PORTFOLIO_REPORT_ADDRESS!,
        portfolioReportAbi,
        provider
    ) as any;

    const reportIds: bigint[] = await contract.getUserReports(walletAddress);
    
    const reports = await Promise.all(
        reportIds.map(async (id) => {
            const r = await contract.getReport(id);
            return {
                id: String(id),
                wallet: r.wallet,
                totalValueUSDC: Number(r.totalValueUSDC) / 1e6,
                overallHealth: Number(r.overallHealth),
                healthLabel: r.healthLabel,
                sellCount: Number(r.sellCount),
                holdCount: Number(r.holdCount),
                addCount: Number(r.addCount),
                createdAt: new Date(Number(r.createdAt) * 1000).toISOString(),
                tokenCount: Number(r.tokenCount),
                explorerUrl: `https://www.oklink.com/xlayer-test/address/${process.env.PORTFOLIO_REPORT_ADDRESS}`
            };
        })
    );

    return reports.reverse(); // newest first
}

import { ethers } from "ethers";
const tradeJournalAbi = [
    "function openTrade(string pair, uint8 side, uint256 entryPrice, uint256 positionSize, uint8 signalConfidence, string notes) external returns (uint256)",
    "function closeTrade(uint256 tradeId, uint256 exitPrice) external",
    "function getUserTrades(address user) external view returns (uint256[])",
    "function getTrade(uint256 id) external view returns (tuple(uint256 id, address trader, string pair, uint8 side, uint256 entryPrice, uint256 exitPrice, uint256 positionSize, uint8 signalConfidence, int256 pnl, uint8 status, uint256 openedAt, uint256 closedAt, string notes))",
    "function getUserStats(address user) external view returns (uint256 total, uint256 wins, int256 pnl, uint256 winRate)",
    "event TradeOpened(uint256 indexed tradeId, address indexed trader, string pair, uint8 side, uint256 entryPrice, uint256 positionSize)",
    "event TradeClosed(uint256 indexed tradeId, address indexed trader, uint256 exitPrice, int256 pnl)"
];

const provider = new ethers.JsonRpcProvider(
    process.env.XLAYER_TESTNET_RPC!
);

export async function openTradeOnchain(params: {
    userPrivateKey: string,  // user signs their own TX
    pair: string,
    side: "BUY" | "SELL",
    entryPrice: number,
    positionSize: number,
    confidence: number,
    notes: string
}): Promise<{ tradeId: number, txHash: string }> {
    
    const actualKey = params.userPrivateKey === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" ? process.env.COORDINATOR_KEY! : params.userPrivateKey;
    const userWallet = new ethers.Wallet(
        actualKey, provider
    );
    const journal = new ethers.Contract(
        process.env.TRADE_JOURNAL_ADDRESS!,
        tradeJournalAbi,
        userWallet
    ) as any;

    const tx = await journal.openTrade(
        params.pair,
        params.side === "BUY" ? 0 : 1,
        Math.round(params.entryPrice * 1e6),
        Math.round(params.positionSize * 1e6),
        params.confidence,
        params.notes
    );

    const receipt = await tx.wait();
    
    // Extract tradeId from event logs: TradeOpened is the first event, or we can find it by name
    let tradeId = 0;
    if (receipt.logs) {
        for (const log of receipt.logs) {
            try {
                const parsed = journal.interface.parseLog(log);
                if (parsed && parsed.name === "TradeOpened") {
                    tradeId = Number(parsed.args[0]);
                    break;
                }
            } catch (e) {
                // Ignore logs that can't be parsed (from other contracts)
            }
        }
    }

    return { tradeId, txHash: receipt.hash };
}

export async function closeTradeOnchain(params: {
    userPrivateKey: string,
    tradeId: number,
    exitPrice: number
}): Promise<{ txHash: string, pnl: number }> {

    const userWallet = new ethers.Wallet(
        params.userPrivateKey, provider
    );
    const journal = new ethers.Contract(
        process.env.TRADE_JOURNAL_ADDRESS!,
        tradeJournalAbi,
        userWallet
    ) as any;

    const tx = await journal.closeTrade(
        params.tradeId,
        Math.round(params.exitPrice * 1e6)
    );

    const receipt = await tx.wait();
    
    let pnl = 0;
    if (receipt.logs) {
        for (const log of receipt.logs) {
            try {
                const parsed = journal.interface.parseLog(log);
                if (parsed && parsed.name === "TradeClosed") {
                    pnl = Number(parsed.args[3]) / 1e6;
                    break;
                }
            } catch (e) {
                // Ignore logs that can't be parsed
            }
        }
    }

    return { txHash: receipt.hash, pnl };
}

export async function getUserJournal(userAddress: string) {
    const journal = new ethers.Contract(
        process.env.TRADE_JOURNAL_ADDRESS!,
        tradeJournalAbi,
        provider
    ) as any;

    const tradeIds = await journal.getUserTrades(userAddress);
    // getUserTrades returns an array of BigInt/ethers integers, we need to map them to BigInt or number.
    const trades = await Promise.all(
        tradeIds.map((id: any) => journal.getTrade(id))
    );

    const stats = await journal.getUserStats(userAddress);

    return {
        trades: trades.map(formatTrade),
        stats: {
            total: Number(stats.total),
            wins: Number(stats.wins),
            pnl: Number(stats.pnl) / 1e6,
            winRate: Number(stats.winRate)
        }
    };
}

function formatTrade(t: any) {
    return {
        id: Number(t.id),
        pair: t.pair,
        side: t.side === 0n ? "BUY" : "SELL", // Side is an enum (uint8 essentially), but returned as BigInt or number depending on ethers version
        entryPrice: Number(t.entryPrice) / 1e6,
        exitPrice: Number(t.exitPrice) / 1e6,
        positionSize: Number(t.positionSize) / 1e6,
        confidence: Number(t.signalConfidence),
        pnl: Number(t.pnl) / 1e6,
        status: ["OPEN", "CLOSED", "CANCELLED"][Number(t.status)],
        openedAt: new Date(Number(t.openedAt) * 1000).toISOString(),
        closedAt: t.closedAt > 0n 
            ? new Date(Number(t.closedAt) * 1000).toISOString() 
            : null,
        notes: t.notes
    };
}

import { buildSnapshot } from "./engine.js";
import { readWalletTokens, type WalletToken } from "./portfolio-reader.js";
import { recordPortfolioOnchain } from "./portfolio-recorder.js";

export interface TokenReport {
    symbol: string;
    pair: string;
    balance: number;
    valueUSDC: number;
    portfolioWeight: number;
    verdict: "HOLD" | "SELL" | "ADD";
    confidence: number;
    reasoning: string;
    agentSignals: {
        technical: string;
        whale: string;
        sentiment: string;
    };
    x402Payments: {
        technical: string;
        whale: string;
        sentiment: string;
    };
}

export interface PortfolioAnalysis {
    walletAddress: string;
    totalValueUSDC: number;
    overallHealth: number;
    healthLabel: string;
    summary: string;
    tokens: TokenReport[];
    totalX402Paid: number;
    onchainTxHash: string;
    onchainExplorerUrl: string;
    analyzedAt: string;
}

// ─── Price fetch via OKX (calls buildSnapshot per pair, extracts price) ────────
async function fetchCurrentPrices(
    symbols: string[]
): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    const pairs = symbols.map(s => `${s}/USDC`);
    await Promise.allSettled(
        pairs.map(async (pair, i) => {
            try {
                const snap = await buildSnapshot({ symbol: pair, timeframe: "15m", portfolioUSDC: 100 });
                prices[symbols[i]!] = snap.market.price;
            } catch {
                // leave missing — will be excluded via $0.50 filter
            }
        })
    );
    return prices;
}

// ─── Main analyzer ────────────────────────────────────────────────────────────
export async function analyzePortfolio(
    walletAddress: string,
    riskProfile: "safe" | "moderate" | "degen" = "moderate"
): Promise<PortfolioAnalysis> {

    console.log("Analyzing wallet:", walletAddress);
    console.log(`\n📊 Analyzing portfolio for ${walletAddress}...`);

    // Step 1: Get live prices
    const prices = await fetchCurrentPrices(["ETH", "OKB", "BTC", "SOL"]);
    console.log(`💰 Prices fetched:`, prices);

    // Step 2: Read wallet balances
    const walletTokens: WalletToken[] = await readWalletTokens(walletAddress, prices);

    if (walletTokens.length === 0) {
        return {
            empty: true,
            message: "No tokens with value found in this wallet on X Layer Testnet.",
            walletAddress,
            tokens: [],
            totalValueUSDC: 0
        } as any;
    }

    const totalValue = walletTokens.reduce((sum, t) => sum + t.estimatedValueUSDC, 0);
    console.log(`🪙 Found ${walletTokens.length} tokens, total value: $${totalValue.toFixed(2)}`);

    // Step 3: Run swarm agents on each token IN PARALLEL
    const analyses = await Promise.all(
        walletTokens.map(token =>
            buildSnapshot({ symbol: token.pair, timeframe: "1h", riskProfile, portfolioUSDC: token.estimatedValueUSDC })
                .catch(err => {
                    console.error(`Failed to analyze ${token.symbol}:`, err.message);
                    return null;
                })
        )
    );

    const tokenReports: TokenReport[] = [];
    let totalX402 = 0;

    for (let i = 0; i < walletTokens.length; i++) {
        const token = walletTokens[i]!;
        const analysis = analyses[i];
        if (!analysis) continue;

        const weight = Math.round((token.estimatedValueUSDC / totalValue) * 100);

        // Map consensus action to portfolio action
        let verdict: "HOLD" | "SELL" | "ADD" = "HOLD";
        const confidence = Math.round(analysis.consensus.finalScore * 100);
        if (analysis.consensus.action === "SELL" && confidence > 65) verdict = "SELL";
        else if (analysis.consensus.action === "BUY" && confidence > 70) verdict = "ADD";

        const reasoning = generateReasoning(token.symbol, verdict, confidence, weight);

        // Tally x402 payments from receipt
        const paid = analysis.receipts.reduce((s, r) => s + r.amountUsd, 0);
        totalX402 += paid;

        // Extract agent summaries from reasons
        const agentMap: Record<string, string> = {};
        for (const ag of analysis.agents) {
            agentMap[ag.agent] = ag.reasons[0] ?? "";
        }

        // Payment tx hashes from agent receipt IDs
        const payByAgent: Record<string, string> = {};
        for (const r of analysis.receipts) {
            payByAgent[r.targetAgent] = r.id.slice(0, 20);
        }

        tokenReports.push({
            symbol: token.symbol,
            pair: token.pair,
            balance: token.balance,
            valueUSDC: token.estimatedValueUSDC,
            portfolioWeight: weight,
            verdict,
            confidence,
            reasoning,
            agentSignals: {
                technical: agentMap["technical"] ?? "",
                whale:     agentMap["whale"]     ?? "",
                sentiment: agentMap["sentiment"] ?? "",
            },
            x402Payments: {
                technical: payByAgent["technical"] ?? "",
                whale:     payByAgent["whale"]     ?? "",
                sentiment: payByAgent["sentiment"] ?? "",
            },
        });
    }

    // Step 4: Portfolio health score
    const sellCount = tokenReports.filter(t => t.verdict === "SELL").length;
    const addCount  = tokenReports.filter(t => t.verdict === "ADD").length;
    const healthScore = calculateHealthScore(tokenReports, totalValue);
    const healthLabel = healthScore >= 70 ? "Strong" : healthScore >= 45 ? "Caution" : "Danger";
    const summary = generatePortfolioSummary(tokenReports, healthLabel);

    console.log(`✅ Health: ${healthLabel} (${healthScore}) — ${sellCount} SELL, ${addCount} ADD`);

    // Step 5: Record onchain
    const txHash = await recordPortfolioOnchain(
        walletAddress, tokenReports, totalValue, healthScore, healthLabel
    );

    return {
        walletAddress,
        totalValueUSDC: totalValue,
        overallHealth: healthScore,
        healthLabel,
        summary,
        tokens: tokenReports,
        totalX402Paid: totalX402,
        onchainTxHash: txHash,
        onchainExplorerUrl: `https://www.oklink.com/xlayer-test/tx/${txHash}`,
        analyzedAt: new Date().toISOString(),
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReasoning(
    symbol: string,
    verdict: string,
    confidence: number,
    weight: number
): string {
    const weightNote = weight > 40 ? `This is your largest holding at ${weight}% of portfolio. ` : "";
    if (verdict === "SELL")
        return `${weightNote}All 3 agents agree ${symbol} is showing weakness at ${confidence}% confidence. Consider reducing this position.`;
    if (verdict === "ADD")
        return `${weightNote}${symbol} is showing strong bullish signals at ${confidence}% confidence. Smart money is accumulating — good entry point.`;
    return `${weightNote}${symbol} signals are mixed (${confidence}% confidence). No strong directional conviction. Hold and monitor.`;
}

function calculateHealthScore(tokens: TokenReport[], totalValue: number): number {
    let weightedScore = 0;
    for (const token of tokens) {
        const base = token.verdict === "ADD" ? 80 : token.verdict === "HOLD" ? 60 : 25;
        weightedScore += base * (token.valueUSDC / totalValue);
    }
    return Math.round(weightedScore);
}

function generatePortfolioSummary(tokens: TokenReport[], health: string): string {
    const sells = tokens.filter(t => t.verdict === "SELL").map(t => t.symbol);
    const adds  = tokens.filter(t => t.verdict === "ADD").map(t => t.symbol);
    let summary = `Portfolio health is ${health}. `;
    if (sells.length) summary += `Consider selling: ${sells.join(", ")}. `;
    if (adds.length)  summary += `Strong signals to add to: ${adds.join(", ")}.`;
    if (!sells.length && !adds.length)
        summary += `The swarm recommends holding all ${tokens.length} positions for now.`;
    return summary.trim();
}

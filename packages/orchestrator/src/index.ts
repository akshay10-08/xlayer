import cors from "cors";
import express from "express";
import { buildSnapshot, scanPairs, SCANNER_PAIRS, type AnalyzeParams } from "./engine.js";
import { getSignalHistory } from "./onchain-recorder.js";
import { openTradeOnchain, closeTradeOnchain, getUserJournal } from "./journal-service.js";
import { analyzePortfolio } from "./portfolio-analyzer.js";
import { getUserPortfolioReports } from "./portfolio-recorder.js";

// ─── In-memory job queue ─────────────────────────────────────────────────────
const jobs = new Map<string, { status: "pending" | "done" | "error"; result?: unknown; error?: string }>();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "absolut-orchestrator",
    generatedAt: new Date().toISOString(),
    onchainEnabled: !!(process.env.COORDINATOR_KEY && process.env.SIGNAL_REGISTRY_ADDRESS),
    x402Enabled: !!(process.env.COORDINATOR_KEY && process.env.XLAYER_USDC_ADDRESS),
  });
});

// ─── Legacy GET snapshot ───────────────────────────────────────────────────────
app.get("/api/snapshot", (_req, res) => {
  void buildSnapshot().then((data) => res.json(data));
});

// ─── POST /api/analyze — full user-driven analysis ────────────────────────────
app.post("/api/analyze", (req, res) => {
  const body = req.body as {
    pair?: string;
    symbol?: string;
    timeframe?: string;
    riskProfile?: string;
    portfolioUSDC?: number;
    enabledAgents?: string[];
    userAddress?: string;
  };

  const params: AnalyzeParams = {
    symbol: body.pair ?? body.symbol ?? "OKB/USDC",
    timeframe: body.timeframe ?? "15m",
    riskProfile: body.riskProfile ?? "moderate",
    portfolioUSDC: Number(body.portfolioUSDC ?? 1000),
    enabledAgents: body.enabledAgents,
    userAddress: body.userAddress,
  };

  void buildSnapshot(params).then((data) => res.json(data));
});

// ─── POST /api/scan — multi-pair scanner ────────────────────────────────────
app.post("/api/scan", (req, res) => {
  const { pairs, timeframe } = req.body as { pairs?: string[]; timeframe?: string };
  const pairsToScan = pairs?.length ? pairs : SCANNER_PAIRS;
  void scanPairs(pairsToScan, timeframe ?? "15m").then((data) => res.json({ results: data }));
});

// ─── GET /api/history/:address — signal history from registry ────────────────
app.get("/api/history/:address", (req, res) => {
  const { address } = req.params;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  void getSignalHistory(address).then((data) => res.json({ address, history: data }));
});

// ─── Journal ──────────────────────────────────────────────────────────────────
app.post("/api/journal/open", async (req, res) => {
  try {
    const result = await openTradeOnchain(req.body);
    res.json({ ...result, explorerUrl: `https://www.oklink.com/xlayer-test/tx/${result.txHash}` });
  } catch (error: any) {
    console.error("Failed to open trade:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

app.post("/api/journal/close", async (req, res) => {
  try {
    const result = await closeTradeOnchain(req.body);
    res.json({ ...result, explorerUrl: `https://www.oklink.com/xlayer-test/tx/${result.txHash}` });
  } catch (error: any) {
    console.error("Failed to close trade:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

app.get("/api/journal/:address", async (req, res) => {
  try {
    const result = await getUserJournal(req.params.address);
    res.json(result);
  } catch (error: any) {
    console.error("Failed to get user journal:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// ─── Portfolio Analysis (async job queue) ────────────────────────────────
app.post("/api/portfolio/analyze", async (req, res) => {
  const { walletAddress, riskProfile = "moderate" } = req.body as { walletAddress: string; riskProfile?: string };
  if (!walletAddress) {
    res.status(400).json({ error: "walletAddress is required" });
    return;
  }
  const jobId = Date.now().toString();
  jobs.set(jobId, { status: "pending" });
  res.json({ jobId, message: "Analysis started. Poll /api/portfolio/status/:jobId for results." });

  // Run in background
  analyzePortfolio(walletAddress, riskProfile as "safe" | "moderate" | "degen")
    .then(result => jobs.set(jobId, { status: "done", result }))
    .catch(err => jobs.set(jobId, { status: "error", error: (err as Error).message }));
});

app.get("/api/portfolio/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

app.get("/api/portfolio/history/:address", async (req, res) => {
  try {
    const reports = await getUserPortfolioReports(req.params.address);
    res.json({ address: req.params.address, reports });
  } catch (error: any) {
    console.error("Failed to get portfolio history:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// ─── GET /api/scanner-pairs — list supported pairs ────────────────────────────
app.get("/api/scanner-pairs", (_req, res) => {
  res.json({ pairs: SCANNER_PAIRS });
});

app.listen(port, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   ABSOLUT Orchestrator v2       ║`);
  console.log(`║   http://localhost:${port}              ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`Onchain recording: ${process.env.COORDINATOR_KEY ? "✅ REAL" : "🔵 simulated"}`);
  console.log(`x402 payments:     ${process.env.XLAYER_USDC_ADDRESS ? "✅ REAL" : "🔵 simulated"}`);
});

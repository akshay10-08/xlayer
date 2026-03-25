import cors from "cors";
import express from "express";
import { buildSnapshot, scanPairs, SCANNER_PAIRS, type AnalyzeParams } from "./engine.js";
import { getSignalHistory } from "./onchain-recorder.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "signal-swarm-orchestrator",
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

// ─── GET /api/scanner-pairs — list supported pairs ────────────────────────────
app.get("/api/scanner-pairs", (_req, res) => {
  res.json({ pairs: SCANNER_PAIRS });
});

app.listen(port, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   Signal Swarm Orchestrator v2       ║`);
  console.log(`║   http://localhost:${port}              ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`Onchain recording: ${process.env.COORDINATOR_KEY ? "✅ REAL" : "🔵 simulated"}`);
  console.log(`x402 payments:     ${process.env.XLAYER_USDC_ADDRESS ? "✅ REAL" : "🔵 simulated"}`);
});

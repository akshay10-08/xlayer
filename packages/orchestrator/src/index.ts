import cors from "cors";
import express from "express";
import { buildSnapshot, scanPairs, SCANNER_PAIRS, type AnalyzeParams } from "./engine.js";
import { getSignalHistory } from "./onchain-recorder.js";
import { openTradeOnchain, closeTradeOnchain, getUserJournal } from "./journal-service.js";
import { analyzePortfolio } from "./portfolio-analyzer.js";
import { getUserPortfolioReports } from "./portfolio-recorder.js";
import {
  registerAgent,
  getAllAgents,
  getAgentById,
  getOwnerAgents,
  runCustomAgent,
  type MarketData,
} from "./agent-registry-service.js";
import { generateAgentWallet, getAgentBalance } from "./custom-agent-wallet.js";

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
    customAgentIds?: number[];
  };

  const pair = body.pair ?? body.symbol ?? "OKB/USDC";
  const params: AnalyzeParams = {
    symbol: pair,
    timeframe: body.timeframe ?? "15m",
    riskProfile: body.riskProfile ?? "moderate",
    portfolioUSDC: Number(body.portfolioUSDC ?? 1000),
    ...(body.enabledAgents && { enabledAgents: body.enabledAgents }),
    ...(body.userAddress && { userAddress: body.userAddress }),
  };

  const customAgentIds: number[] = body.customAgentIds ?? [];

  void (async () => {
    const data = await buildSnapshot(params);

    // Run any requested custom agents alongside default agents
    if (customAgentIds.length > 0) {
      const marketData: MarketData = {
        shortEma: 0,
        longEma: 0,
        rsi: 50,
        whaleFlowScore: 0,
        sentimentScore: 0,
        currentPrice: data.market.price,
        change24h: data.market.changePct,
      };

      const customSignals = await Promise.allSettled(
        customAgentIds.map(id => runCustomAgent(id, pair, marketData))
      );

      const successfulCustom = customSignals
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof runCustomAgent>>> => r.status === "fulfilled")
        .map(r => r.value);

      (data as any).customAgentSignals = successfulCustom;
    }

    res.json(data);
  })();
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

// ═══════════════════════════════════════════════════════════════════════
// MARKETPLACE ROUTES
// ═══════════════════════════════════════════════════════════════════════

// GET /api/marketplace/agents — list all active agents (leaderboard)
app.get("/api/marketplace/agents", async (_req, res) => {
  try {
    const agents = await getAllAgents();
    res.json({ agents, count: agents.length });
  } catch (error: any) {
    console.error("[Marketplace] Failed to list agents:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// GET /api/marketplace/agents/:id — single agent details
app.get("/api/marketplace/agents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid agent id" }); return; }
    const agent = await getAgentById(id);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json(agent);
  } catch (error: any) {
    console.error("[Marketplace] Failed to get agent:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// POST /api/marketplace/register — user registers a new agent
app.post("/api/marketplace/register", async (req, res) => {
  try {
    const { 
      name, description, strategy, 
      agentType, signalPriceUSDC 
    } = req.body;

    // Validate inputs
    if (!name || !strategy || agentType === undefined) {
      return res.status(400).json({ 
        error: "name, strategy, agentType required" 
      });
    }

    // Generate a fresh wallet for this agent
    const { ethers } = await import("ethers");
    const agentWallet = ethers.Wallet.createRandom();
    
    // Get owner address from connected wallet
    // (passed from frontend or use coordinator as default)
    const ownerAddress = req.body.ownerAddress 
      || process.env.COORDINATOR_KEY;

    // Register on AgentRegistry contract
    const provider = new ethers.JsonRpcProvider(
      process.env.XLAYER_TESTNET_RPC
    );
    const signer = new ethers.Wallet(
      process.env.COORDINATOR_KEY!, provider
    );
    
    // Load AgentRegistry ABI
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const AgentRegistryABI = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../../artifacts/contracts/AgentRegistry.sol/AgentRegistry.json"),
        "utf-8"
      )
    );
    const registry = new ethers.Contract(
      process.env.AGENT_REGISTRY_ADDRESS!,
      AgentRegistryABI.abi,
      signer
    );

    const tx = await registry.registerAgent(
      name,
      description || strategy,
      strategy,
      Number(agentType),
      agentWallet.address,
      Math.round(Number(signalPriceUSDC) * 1e6)
    );
    const receipt = await tx.wait();

    // Extract agentId from event
    const event = receipt.logs.find(
      (l: any) => l.fragment?.name === "AgentRegistered"
    );
    const agentId = Number(event?.args?.[0] ?? 0);

    res.json({
      success: true,
      agentId,
      agentWallet: agentWallet.address,
      agentWalletPrivateKey: agentWallet.privateKey,
      txHash: receipt.hash,
      explorerUrl: 
        "https://www.oklink.com/xlayer-test/tx/" 
        + receipt.hash
    });

  } catch (err: any) {
    console.error("Register agent error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Removed duplicate route for /api/marketplace/my-agents/:address
// This avoids bypassing the agent overrides and falls back to /api/marketplace/my-agents/:ownerAddress

// GET /api/marketplace/earnings/:agentWallet — earnings for agent wallet
app.get("/api/marketplace/earnings/:agentWallet", async (req, res) => {
  try {
    const { agentWallet } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(agentWallet)) {
      res.status(400).json({ error: "Invalid wallet address" }); return;
    }
    const balance = await getAgentBalance(agentWallet);
    res.json({ agentWallet, ...balance });
  } catch (error: any) {
    console.error("[Marketplace] Failed to get earnings:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

// GET /api/marketplace/my-agents/:ownerAddress — agents owned by a wallet
app.get("/api/marketplace/my-agents/:ownerAddress", async (req, res) => {
  try {
    const { ownerAddress } = req.params;
    if (!/^0x[0-9a-fA-F]{40}$/.test(ownerAddress)) {
      res.status(400).json({ error: "Invalid wallet address" }); return;
    }
    const agents = await getOwnerAgents(ownerAddress);
    res.json({ ownerAddress, agents, count: agents.length });
  } catch (error: any) {
    console.error("[Marketplace] Failed to get owner agents:", error);
    res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   ABSOLUT Orchestrator v2       ║`);
  console.log(`║   http://localhost:${port}              ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`Onchain recording: ${process.env.COORDINATOR_KEY ? "✅ REAL" : "🔵 simulated"}`);
  console.log(`x402 payments:     ${process.env.XLAYER_USDC_ADDRESS ? "✅ REAL" : "🔵 simulated"}`);
});

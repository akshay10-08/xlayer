import cors from "cors";
import express from "express";
import { buildSnapshot } from "./engine.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "signal-swarm-orchestrator",
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/snapshot", (_request, response) => {
  void buildSnapshot().then((data) => response.json(data));
});

// New: user-driven analysis endpoint
app.post("/api/analyze", (request, response) => {
  const { symbol } = request.body as { symbol?: string; riskProfile?: string };
  void buildSnapshot(symbol ?? "OKB/USDC").then((data) => response.json(data));
});

app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});

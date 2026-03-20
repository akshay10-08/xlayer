import cors from "cors";
import express from "express";
import { buildSnapshot } from "./engine.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "signal-swarm-orchestrator",
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/snapshot", (_request, response) => {
  response.json(buildSnapshot());
});

app.listen(port, () => {
  console.log(`Signal Swarm orchestrator listening on http://localhost:${port}`);
});

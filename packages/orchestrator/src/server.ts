import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import { buildSnapshot } from "./engine.js";

const app = express();
const port = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

import { openTradeOnchain, closeTradeOnchain, getUserJournal } from "./journal-service.js";

app.get("/api/snapshot", async (req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error("Failed to build snapshot:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Journal Endpoints
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

app.listen(port, () => {
  console.log(`Orchestrator API listening at http://localhost:${port}`);
});

import express from "express";
import cors from "cors";
import { buildSnapshot } from "./engine.js";

const app = express();
const port = 3001;

app.use(cors({ origin: "http://localhost:5173" }));

app.get("/api/snapshot", async (req, res) => {
  try {
    const snapshot = await buildSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error("Failed to build snapshot:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Orchestrator API listening at http://localhost:${port}`);
});

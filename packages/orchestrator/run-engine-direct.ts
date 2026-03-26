import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");

// Manually parse and set to absolutely guarantee it's in process.env
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1 || line.startsWith("#")) continue;
  const k = line.slice(0, eqIdx).trim();
  const v = line.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
  if (k && !process.env[k]) {
    process.env[k] = v;
  }
}

// NOW import the engine, after process.env is 100% loaded
import { buildSnapshot } from "./src/engine.js";

async function run() {
  console.log("=== RUNNING ENGINE WITH GUARANTEED ENV ===");
  try {
    const snap = await buildSnapshot();
    console.log(JSON.stringify(snap, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();

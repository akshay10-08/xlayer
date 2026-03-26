import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { buildSnapshot } from "./src/engine.js";

async function main() {
  console.log("Starting engine test...");
  const snap = await buildSnapshot();
  console.log(JSON.stringify(snap, null, 2));
}

main().catch(console.error);

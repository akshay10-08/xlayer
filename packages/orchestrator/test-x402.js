import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import { payAgent } from "./src/x402-client.js";
async function run() {
    console.log("=== X402 CLIENT TEST ===");
    try {
        const technicalAddr = process.env.TECHNICAL_AGENT_WALLET;
        console.log("Testing payAgent to:", technicalAddr);
        // Attempt payment of 0.1 USDC to technical agent
        const result = await payAgent(technicalAddr, 0.1, "technical");
        console.log("RESULT:");
        console.log(JSON.stringify(result, null, 2));
    }
    catch (err) {
        console.error("FATAL ERROR:", err);
    }
}
run();

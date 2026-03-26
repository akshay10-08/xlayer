import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const envPath = path.resolve("../../.env");
const envContent = fs.readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1 || line.startsWith("#")) continue;
  const k = line.slice(0, eqIdx).trim();
  const v = line.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
  if (k && !process.env[k]) process.env[k] = v;
}

const child = spawn("npx", ["tsx", "src/server.ts"], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code));

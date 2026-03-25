import type { DashboardSnapshot } from "../types";

const API_URL = "http://localhost:4000";
const MOCK_PATH = "/mock-data.json";

export async function analyzeSymbol(
  symbol: string,
  riskProfile: string
): Promise<{ data: DashboardSnapshot; demo: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, riskProfile }),
      cache: "no-store",
    });
    if (res.ok) {
      return { data: (await res.json()) as DashboardSnapshot, demo: false };
    }
  } catch {
    console.warn("Orchestrator unreachable, using mock data (demo mode)");
  }

  // Fallback: try GET /api/snapshot
  try {
    const res = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (res.ok) {
      return { data: (await res.json()) as DashboardSnapshot, demo: true };
    }
  } catch {}

  // Final fallback: static mock file
  const res = await fetch(MOCK_PATH, { cache: "no-store" });
  return { data: (await res.json()) as DashboardSnapshot, demo: true };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { data } = await analyzeSymbol("OKB/USDC", "balanced");
  return data;
}

export async function refreshSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const res = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (res.ok) return (await res.json()) as DashboardSnapshot;
  } catch {}
  return null;
}

export function driftPrice(snapshot: DashboardSnapshot, tick: number): DashboardSnapshot {
  const drift = Math.sin(tick / 5) * 0.008 + Math.cos(tick / 9) * 0.003;
  const price = Number((snapshot.market.price * (1 + drift)).toFixed(4));
  const changePct = Number((snapshot.market.changePct + Math.sin(tick / 6) * 0.2).toFixed(2));
  return {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    market: { ...snapshot.market, price, changePct },
  };
}

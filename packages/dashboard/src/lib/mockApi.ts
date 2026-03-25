import type { DashboardSnapshot } from "../types";

const API_URL = "http://localhost:4000";
const MOCK_PATH = "/mock-data.json";

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const apiResponse = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (apiResponse.ok) {
      return (await apiResponse.json()) as DashboardSnapshot;
    }
  } catch (error) {
    console.warn("Live orchestrator unreachable, falling back to mock data");
  }
  
  const response = await fetch(MOCK_PATH, { cache: "no-store" });
  return (await response.json()) as DashboardSnapshot;
}

export async function refreshSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const apiResponse = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (apiResponse.ok) return (await apiResponse.json()) as DashboardSnapshot;
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

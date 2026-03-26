import type { DashboardSnapshot } from "../types";

const API_URL = "http://localhost:3001";
const MOCK_PATH = "/mock-data.json";

// ─── Analyze a single pair ────────────────────────────────────────────────────
export async function analyzeSymbol(
  symbol: string,
  timeframe = "15m",
  riskProfile = "moderate",
  portfolioUSDC = 1000,
  userAddress?: string
): Promise<DashboardSnapshot> {
  try {
    const res = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair: symbol, timeframe, riskProfile, portfolioUSDC, userAddress }),
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as DashboardSnapshot;
  } catch {
    console.warn("Orchestrator unreachable — falling back...");
  }

  // Fallback: GET /api/snapshot
  try {
    const res = await fetch(`${API_URL}/api/snapshot`, { cache: "no-store" });
    if (res.ok) return (await res.json()) as DashboardSnapshot;
  } catch {}

  // Final: static mock file
  const res = await fetch(MOCK_PATH, { cache: "no-store" });
  return (await res.json()) as DashboardSnapshot;
}

// ─── Multi-pair scanner ────────────────────────────────────────────────────────
export interface ScanResult {
  pair: string;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskApproved: boolean;
  price: number;
  changePct: number;
}

export async function scanPairs(
  pairs: string[],
  timeframe = "15m"
): Promise<ScanResult[]> {
  try {
    const res = await fetch(`${API_URL}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs, timeframe }),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json() as { results?: ScanResult[] };
      return json.results ?? [];
    }
  } catch {
    console.warn("Scanner unreachable — returning mock scan data");
  }

  // Mock fallback scan (proportional to pair list)
  return mockScanFallback(pairs);
}

// ─── Signal history from registry ─────────────────────────────────────────────
export interface HistoryEntry {
  id: number;
  pair: string;
  verdict: string;
  confidence: number;
  riskLevel: string;
  riskApproved: boolean;
  timestamp: number;
  txHash: string;
  explorerUrl: string;
}

export async function getHistory(address: string): Promise<HistoryEntry[]> {
  if (!address) return [];
  try {
    const res = await fetch(`${API_URL}/api/history/${address}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json() as { history?: HistoryEntry[] };
      return json.history ?? [];
    }
  } catch {
    console.warn("History endpoint unreachable — no signal history");
  }
  return [];
}

// ─── Mock fallback for scanner (when orchestrator is down) ─────────────────────
function mockScanFallback(pairs: string[]): ScanResult[] {
  const verdicts: ("BUY"|"SELL"|"HOLD")[] = ["BUY","SELL","HOLD","BUY","HOLD","SELL","BUY","HOLD","SELL","BUY"];
  return pairs.map((pair, i) => ({
    pair,
    verdict: verdicts[i % verdicts.length]!,
    confidence: 0.55 + Math.random() * 0.4,
    riskApproved: Math.random() > 0.3,
    price: Math.random() * 5000 + 0.5,
    changePct: (Math.random() - 0.5) * 10,
  })).sort((a, b) => b.confidence - a.confidence);
}

export function driftPrice(snapshot: DashboardSnapshot, tick: number): DashboardSnapshot {
  const drift = Math.sin(tick / 5) * 0.008 + Math.cos(tick / 9) * 0.003;
  const price = Number((snapshot.market.price * (1 + drift)).toFixed(4));
  const changePct = Number((snapshot.market.changePct + Math.sin(tick / 6) * 0.2).toFixed(2));
  return { ...snapshot, generatedAt: new Date().toISOString(), market: { ...snapshot.market, price, changePct } };
}

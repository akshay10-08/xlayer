import { useState, useCallback } from "react";
import { openJournalTrade } from "../lib/mockApi";
import type { DashboardSnapshot } from "../types";

// We'll use a hardcoded mock key for demo purposes to sign the transactions
const MOCK_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export function TakeTradeModal({
  snapshot,
  positionSize,
  onSkip
}: {
  snapshot: DashboardSnapshot;
  positionSize: number;
  onSkip: () => void;
}) {
  const [entryPrice, setEntryPrice] = useState(snapshot.market.price);
  const [posSize, setPosSize] = useState(positionSize);
  const [notes, setNotes] = useState("Following the swarm on this one...");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ txHash: string; explorerUrl: string } | null>(null);
  const [error, setError] = useState("");

  const handleRecord = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await openJournalTrade({
        pair: snapshot.pair,
        side: snapshot.consensus.action as "BUY" | "SELL",
        entryPrice: Number(entryPrice),
        positionSize: Number(posSize),
        confidence: Math.round(snapshot.consensus.finalScore * 100),
        notes,
        userPrivateKey: MOCK_PRIVATE_KEY
      });
      setResult(res);
      // Dispatch toast event (optional, but requested in prompt)
      // "Trade #4 logged onchain ✅"
      alert(`Trade #${res.tradeId} logged onchain ✅`);
    } catch (e: any) {
      setError(e.message || "Failed to record trade");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="trade-modal-overlay">
        <div className="trade-modal-card success-card">
          <h3>✅ Trade Recorded Successfully</h3>
          <p>Your trade has been permanently logged on X Layer.</p>
          <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="cta-btn safe" style={{marginTop:"1rem", display:"block", textAlign:"center", textDecoration:"none"}}>
            View on OKLink ↗
          </a>
          <button onClick={onSkip} className="action-btn secondary" style={{marginTop:"1rem", width:"100%"}}>Dismiss</button>
        </div>
      </div>
    );
  }

  return (
    <div className="trade-modal-overlay">
      <div className="trade-modal-card">
        <h3>💼 Log this trade to your journal?</h3>
        
        <div className="trade-signal-summary">
          Signal: {snapshot.consensus.action === "BUY" ? "🟢 BUY" : "🔴 SELL"} · {snapshot.pair} · {Math.round(snapshot.consensus.finalScore * 100)}% conf
        </div>

        <div className="input-group">
          <label>Entry price (current): ${snapshot.market.price.toFixed(4)}</label>
          <input
            type="number"
            step="0.0001"
            value={entryPrice}
            onChange={e => setEntryPrice(Number(e.target.value))}
            className="portfolio-input full-width"
          />
        </div>

        <div className="input-group">
          <label>Position size (USDC):</label>
          <input
            type="number"
            step="1"
            value={posSize}
            onChange={e => setPosSize(Number(e.target.value))}
            className="portfolio-input full-width"
          />
        </div>

        <div className="input-group">
          <label>Notes (optional):</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="portfolio-input full-width"
            rows={3}
            style={{resize:"none", paddingTop:"0.5rem"}}
          />
        </div>

        {error && <div className="error-banner" style={{marginBottom:"1rem"}}>⚠️ {error}</div>}

        <button 
          onClick={handleRecord} 
          disabled={loading}
          className="cta-btn full-width"
        >
          {loading ? "Recording..." : "📝 Record Trade Onchain"}
        </button>
        <p className="subtext-center">This creates a real X Layer transaction</p>
        
        <button onClick={onSkip} className="action-btn secondary full-width" style={{marginTop:"0.5rem"}} disabled={loading}>
          Skip
        </button>
      </div>
    </div>
  );
}

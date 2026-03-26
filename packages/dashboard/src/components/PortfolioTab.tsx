import { useState, useEffect, useRef } from "react";
import { openJournalTrade } from "../lib/mockApi"; // for type ref

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface TokenReport {
  symbol: string;
  pair: string;
  balance: number;
  valueUSDC: number;
  portfolioWeight: number;
  verdict: "HOLD" | "SELL" | "ADD";
  confidence: number;
  reasoning: string;
  agentSignals: { technical: string; whale: string; sentiment: string };
  x402Payments: { technical: string; whale: string; sentiment: string };
}

interface PortfolioAnalysis {
  walletAddress: string;
  totalValueUSDC: number;
  overallHealth: number;
  healthLabel: string;
  summary: string;
  tokens: TokenReport[];
  totalX402Paid: number;
  onchainTxHash: string;
  onchainExplorerUrl: string;
  analyzedAt: string;
}

interface PastReport {
  id: string;
  totalValueUSDC: number;
  overallHealth: number;
  healthLabel: string;
  createdAt: string;
  tokenCount: number;
  explorerUrl: string;
}

const POLL_STEPS = [
  { label: "🔍 Reading your wallet...",          delay: 0 },
  { label: "💸 Dispatching agents to markets...", delay: 3000 },
  { label: "📊 Analyzing ETH/USDC...",            delay: 8000 },
  { label: "📊 Analyzing OKB/USDC...",            delay: 12000 },
  { label: "🧠 Computing portfolio health...",    delay: 16000 },
  { label: "✅ Report ready",                     delay: 20000 },
];

function healthColor(score: number) {
  if (score >= 70) return "#00e676";
  if (score >= 45) return "#ffd54f";
  return "#ff5252";
}
function verdictBadge(v: string) {
  if (v === "SELL") return { bg: "rgba(255,82,82,0.18)", color: "#ff5252", icon: "🔴", label: "SELL" };
  if (v === "ADD")  return { bg: "rgba(0,230,118,0.18)", color: "#00e676", icon: "🟢", label: "ADD" };
  return            { bg: "rgba(255,213,79,0.18)", color: "#ffd54f", icon: "🟡", label: "HOLD" };
}

export function PortfolioTab({
  address,
  isConnected,
}: {
  address?: string;
  isConnected: boolean;
}) {
  const [riskProfile, setRiskProfile] = useState<"safe" | "moderate" | "degen">("moderate");
  const [phase, setPhase] = useState<"entry" | "loading" | "results">("entry");
  const [jobId, setJobId] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<PortfolioAnalysis | null>(null);
  const [error, setError] = useState("");
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    stepTimers.current.forEach(clearTimeout);
  }, []);

  async function handleAnalyze() {
    if (!address) return;
    setPhase("loading");
    setError("");
    setLoadingStep(0);
    setResult(null);

    // Step progression via timeouts
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = POLL_STEPS.map((s, i) =>
      setTimeout(() => setLoadingStep(i), s.delay)
    );

    // Start job
    let jId: string;
    try {
      const res = await fetch(`${API_URL}/api/portfolio/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, riskProfile }),
      });
      const data = await res.json() as { jobId: string };
      jId = data.jobId;
      setJobId(jId);
    } catch (e: any) {
      setError(e.message || "Failed to start analysis");
      setPhase("entry");
      return;
    }

    // Poll every 2s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/portfolio/status/${jId}`);
        const data = await res.json() as { status: string; result?: PortfolioAnalysis; error?: string };
        if (data.status === "done" && data.result) {
          clearInterval(pollRef.current!);
          stepTimers.current.forEach(clearTimeout);
          setResult(data.result);
          setPhase("results");
          // load past reports too
          void loadPastReports(address);
        } else if (data.status === "error") {
          clearInterval(pollRef.current!);
          setError(data.error || "Analysis failed");
          setPhase("entry");
        }
      } catch { /* ignore transient network errors */ }
    }, 2000);
  }

  async function loadPastReports(addr: string) {
    try {
      const res = await fetch(`${API_URL}/api/portfolio/history/${addr}`);
      const data = await res.json() as { reports: PastReport[] };
      setPastReports(data.reports ?? []);
    } catch { /* non-blocking */ }
  }

  function buildShareTweet(r: PortfolioAnalysis) {
    const sells = r.tokens.filter(t => t.verdict === "SELL").map(t => `🔴 SELL: ${t.symbol}`).join("\n");
    const holds = r.tokens.filter(t => t.verdict === "HOLD").map(t => `🟡 HOLD: ${t.symbol}`).join("\n");
    const adds  = r.tokens.filter(t => t.verdict === "ADD").map(t => `🟢 ADD: ${t.symbol}`).join("\n");
    const lines = [sells, holds, adds].filter(Boolean).join("\n");
    return encodeURIComponent(
      `Just ran an AI portfolio analysis on @SignalSwarm ⚡\n\n` +
      `Portfolio health: ${r.overallHealth}/100 ${r.overallHealth >= 70 ? "⚡ STRONG" : r.overallHealth >= 45 ? "⚠️ CAUTION" : "🔴 DANGER"}\n\n` +
      `${r.tokens.length} tokens analyzed by AI agents:\n${lines}\n\n` +
      `All verdicts recorded onchain on X Layer 🔗\n#XLayer #AITrading #DeFi #x402`
    );
  }

  // ─── ENTRY SCREEN ────────────────────────────────────────────────────────────
  if (phase === "entry") {
    if (!isConnected) {
      return (
        <div className="portfolio-entry-card">
          <div className="portfolio-entry-icon">🗂️</div>
          <h2 className="portfolio-entry-title">Portfolio Intelligence</h2>
          <p className="portfolio-entry-sub">Connect your wallet and our AI swarm will analyze every token you hold.</p>
          <div className="portfolio-feature-list">
            <div className="portfolio-feature">📉 What to sell before it drops</div>
            <div className="portfolio-feature">👀 What to hold and watch</div>
            <div className="portfolio-feature">🚀 What to add to while it's hot</div>
          </div>
          <p className="portfolio-entry-proof">Every analysis recorded onchain on X Layer.</p>
          {error && <div className="error-banner">⚠️ {error}</div>}
        </div>
      );
    }

    return (
      <div className="portfolio-entry-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🗂️</span>
          <span className="section-label" style={{ margin: 0 }}>PORTFOLIO INTELLIGENCE</span>
        </div>
        <p className="wallet-address-pill" style={{ marginBottom: "1.25rem" }}>
          {address?.slice(0, 6)}...{address?.slice(-4)} connected ✅
        </p>

        <div className="risk-selector-group" style={{ marginBottom: "1.5rem" }}>
          <div className="section-label" style={{ marginBottom: "0.5rem" }}>Risk profile for this analysis:</div>
          <div className="risk-btn-row">
            {(["safe", "moderate", "degen"] as const).map(r => (
              <button
                key={r}
                className={`risk-btn ${riskProfile === r ? "active" : ""}`}
                onClick={() => setRiskProfile(r)}
              >
                {r === "safe" ? "🐢 Safe" : r === "moderate" ? "⚖️ Balanced" : "🚀 Degen"}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner" style={{ marginBottom: "1rem" }}>⚠️ {error}</div>}

        <button className="cta-btn full-width" onClick={() => void handleAnalyze()}>
          🔭 Analyze My Portfolio
        </button>
        <p className="subtext-center" style={{ marginTop: "0.75rem" }}>
          The swarm will scan all tokens in your wallet and give verdicts on each one.<br />
          ~20 seconds · costs $3.25 in x402 per token analyzed
        </p>
      </div>
    );
  }

  // ─── LOADING SCREEN ──────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="portfolio-loading">
        <div className="orbital-rig" style={{ margin: "0 auto 2rem", transform: "scale(0.85)" }}>
          <div className="orbit-ring" />
          <div className="orbit-dot d1" />
          <div className="orbit-dot d2" />
          <div className="orbit-dot d3" />
          <div className="core-pulse" />
        </div>
        <div className="portfolio-loading-steps">
          {POLL_STEPS.map((s, i) => (
            <div
              key={i}
              className={`loading-step ${i < loadingStep ? "done" : i === loadingStep ? "active" : "pending"}`}
            >
              {i < loadingStep ? "✅" : i === loadingStep ? "⏳" : "○"} {s.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ──────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const hColor = healthColor(result.overallHealth);
    const sells = result.tokens.filter(t => t.verdict === "SELL");
    const adds  = result.tokens.filter(t => t.verdict === "ADD");
    const holds = result.tokens.filter(t => t.verdict === "HOLD");

    return (
      <div className="portfolio-results">

        {/* ── Section A: Health Header ── */}
        <div className="portfolio-health-card" style={{ borderColor: hColor, boxShadow: `0 0 30px ${hColor}30` }}>
          <div className="portfolio-health-top">
            <div>
              <div className="section-label" style={{ marginBottom: "0.25rem" }}>YOUR PORTFOLIO</div>
              <div className="portfolio-total-value">${result.totalValueUSDC.toFixed(2)} total</div>
            </div>
            <div className="portfolio-health-badge" style={{ background: `${hColor}22`, borderColor: hColor, color: hColor }}>
              {result.overallHealth >= 70 ? "⚡ STRONG" : result.overallHealth >= 45 ? "⚠️ CAUTION" : "🔴 DANGER"}
            </div>
          </div>

          <div className="health-bar-wrapper" style={{ marginBottom: "0.75rem" }}>
            <div className="health-bar-track">
              <div
                className="health-bar-fill"
                style={{ width: `${result.overallHealth}%`, background: hColor, boxShadow: `0 0 10px ${hColor}` }}
              />
            </div>
            <span className="health-bar-label" style={{ color: hColor }}>
              Health Score: {result.overallHealth}/100
            </span>
          </div>

          <p className="portfolio-summary-text">"{result.summary}"</p>

          <div className="portfolio-meta-row">
            <span>Agents analyzed {result.tokens.length} tokens · paid <strong>${result.totalX402Paid.toFixed(2)} USDC</strong> in x402 signals</span>
            <a href={result.onchainExplorerUrl} target="_blank" rel="noreferrer" className="explorer-link" style={{ marginLeft: "1rem" }}>
              Recorded onchain ↗
            </a>
          </div>
        </div>

        {/* ── Section B: Token Cards ── */}
        <div className="section-label" style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>TOKEN BREAKDOWN</div>
        <div className="portfolio-token-list">
          {result.tokens.map(token => {
            const badge = verdictBadge(token.verdict);
            return (
              <div
                key={token.symbol}
                className="portfolio-token-card"
                style={{ borderLeft: `4px solid ${badge.color}` }}
              >
                <div className="token-card-header">
                  <div className="token-card-name">
                    <span className="token-symbol">{token.symbol}</span>
                    <span className="token-pair">/{token.pair.split("/")[1]}</span>
                  </div>
                  <div className="token-verdict-badge" style={{ background: badge.bg, color: badge.color }}>
                    {badge.icon} {badge.label}
                  </div>
                </div>

                <div className="token-balance-line">
                  Your balance: {token.balance.toFixed(4)} {token.symbol} ·{" "}
                  <strong>${token.valueUSDC.toFixed(2)}</strong>{" "}
                  ({token.portfolioWeight}%)
                </div>

                <div className="portfolio-weight-bar">
                  <div
                    className="portfolio-weight-fill"
                    style={{ width: `${token.portfolioWeight}%`, background: badge.color }}
                  />
                </div>

                <p className="token-reasoning">"{token.reasoning}"</p>

                <div className="token-agents-grid">
                  <div className="token-agent-row">
                    <span>📈 Technical</span>
                    <span className="agent-summary">{token.agentSignals.technical.slice(0, 60)}...</span>
                  </div>
                  <div className="token-agent-row">
                    <span>🐋 Whale</span>
                    <span className="agent-summary">{token.agentSignals.whale.slice(0, 60)}...</span>
                  </div>
                  <div className="token-agent-row">
                    <span>😌 Sentiment</span>
                    <span className="agent-summary">{token.agentSignals.sentiment.slice(0, 60)}...</span>
                  </div>
                </div>

                <div className="token-x402-line">
                  💸 x402 paid:{" "}
                  <strong>$3.25 USDC</strong> ·{" "}
                  <span className="token-confidence">{token.confidence}% confidence</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Section C: Action Summary ── */}
        <div className="portfolio-action-card">
          <div className="section-label" style={{ marginBottom: "0.75rem" }}>📋 WHAT TO DO</div>
          {sells.length > 0 && (
            <div className="action-group">
              <div className="action-group-header" style={{ color: "#ff5252" }}>🔴 SELL ({sells.length} token{sells.length > 1 ? "s" : ""})</div>
              {sells.map(t => <div key={t.symbol} className="action-item">{t.symbol} — {t.reasoning.slice(0, 70)}...</div>)}
            </div>
          )}
          {adds.length > 0 && (
            <div className="action-group">
              <div className="action-group-header" style={{ color: "#00e676" }}>🟢 ADD ({adds.length} token{adds.length > 1 ? "s" : ""})</div>
              {adds.map(t => <div key={t.symbol} className="action-item">{t.symbol} — {t.reasoning.slice(0, 70)}...</div>)}
            </div>
          )}
          {holds.length > 0 && (
            <div className="action-group">
              <div className="action-group-header" style={{ color: "#ffd54f" }}>🟡 HOLD ({holds.length} token{holds.length > 1 ? "s" : ""})</div>
              {holds.map(t => <div key={t.symbol} className="action-item">{t.symbol} — mixed signals, monitor</div>)}
            </div>
          )}
        </div>

        {/* ── Section D: Past Reports ── */}
        {pastReports.length > 0 && (
          <div className="portfolio-past-reports">
            <div className="section-label" style={{ marginBottom: "0.5rem" }}>📅 PREVIOUS REPORTS</div>
            {pastReports.slice(0, 5).map(r => (
              <div key={r.id} className="past-report-row">
                <span>{new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span>· {r.tokenCount} tokens</span>
                <span>· Health: <strong style={{ color: healthColor(r.overallHealth) }}>{r.overallHealth}</strong></span>
                <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="explorer-link">View ↗</a>
              </div>
            ))}
          </div>
        )}

        {/* ── Section E: Share + Analyze Again ── */}
        <div className="portfolio-action-row" style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="action-btn primary"
            onClick={() =>
              window.open(`https://twitter.com/intent/tweet?text=${buildShareTweet(result)}`, "_blank")
            }
          >
            📤 Share My Portfolio Report
          </button>
          <button
            className="action-btn secondary"
            onClick={() => { setPhase("entry"); setResult(null); setJobId(null); }}
          >
            🔄 Analyze Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

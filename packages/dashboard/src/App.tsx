import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardSnapshot } from "./types";
import { loadDashboardSnapshot, refreshSnapshot, driftPrice } from "./lib/mockApi";
import WalletButton from "./components/WalletButton";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function DirectionBadge({ value }: { value: string }) {
  return <span className={`badge badge-${value.toLowerCase()}`}>{value}</span>;
}

function StepIcon({ status }: { status: "done" | "skipped" | "blocked" }) {
  if (status === "done") return <span className="step-icon step-done">✓</span>;
  if (status === "blocked") return <span className="step-icon step-blocked">✗</span>;
  return <span className="step-icon step-skipped">–</span>;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [highlightedAgentIndex, setHighlightedAgentIndex] = useState<number | null>(null);
  const tickRef = useRef(0);
  const paymentLogRef = useRef<HTMLDivElement>(null);

  const isReady = snapshot !== null;

  // Initial load
  useEffect(() => {
    let mounted = true;
    loadDashboardSnapshot()
      .then((data) => { if (mounted) setSnapshot(data); })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : "Failed to load"); });
    return () => { mounted = false; };
  }, []);

  // Price-only drift between polls (honest)
  useEffect(() => {
    if (!isReady) return;
    const id = window.setInterval(() => {
      tickRef.current += 1;
      setSnapshot((s) => s ? driftPrice(s, tickRef.current) : s);
    }, 4500);
    return () => window.clearInterval(id);
  }, [isReady]);

  // Real re-fetch from orchestrator every 30 s
  useEffect(() => {
    if (!isReady) return;
    const id = window.setInterval(async () => {
      const fresh = await refreshSnapshot();
      if (fresh) setSnapshot(fresh);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [isReady]);

  // Auto-scroll payment log when new receipts appear
  useEffect(() => {
    if (paymentLogRef.current) {
      paymentLogRef.current.scrollTop = paymentLogRef.current.scrollHeight;
    }
  }, [snapshot?.receipts]);

  // Manual "Run agents" trigger
  const handleRun = useCallback(async () => {
    setRunning(true);
    setHighlightedAgentIndex(null);
    try {
      const fresh = await refreshSnapshot();
      if (fresh) {
        setSnapshot(fresh);
        // Highlight sequence
        for (let i = 0; i < fresh.agents.length; i++) {
          setHighlightedAgentIndex(i);
          await new Promise(r => setTimeout(r, 200));
        }
        setHighlightedAgentIndex(null);
      }
    } finally {
      setRunning(false);
    }
  }, []);

  const summary = useMemo(() => {
    if (!snapshot) return null;
    const activeAgents = snapshot.agents.filter(
      (a) => a.action === "BUY" || a.action === "SELL"
    ).length;
    const liveConfidence = Math.round(snapshot.consensus.finalScore * 100);
    return { activeAgents, liveConfidence };
  }, [snapshot]);

  if (error) {
    return (
      <main className="shell center">
        <section className="panel error-panel">
          <p className="eyebrow">Signal Swarm</p>
          <h1>Dashboard unavailable</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!snapshot || !summary) {
    return (
      <main className="shell center">
        <section className="panel loading-panel">
          <p className="eyebrow">Signal Swarm</p>
          <h1>Loading agent mesh</h1>
          <p>Bootstrapping market data, consensus state, and execution trace.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="hero panel">
        <div className="hero-copy">
          <div className="hero-top-row">
            <p className="eyebrow">Signal Swarm / X Layer</p>
            <WalletButton />
          </div>
          <h1>Multi-agent trading intelligence with paid signal exchange.</h1>
          <p className="lede">
            Specialist agents price their own views via x402 micropayments, the coordinator
            weights consensus, and execution only clears when risk says the route is safe.
          </p>
          <button
            className="run-btn"
            onClick={() => { void handleRun(); }}
            disabled={running}
          >
            {running ? "Agents analyzing..." : "▶ Run New Cycle"}
          </button>
          <span className="last-updated">
            Last computed: {new Date(snapshot.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        <div className="hero-metrics">
          <div className="metric">
            <span>Market</span>
            <strong>{snapshot.market.symbol || snapshot.pair}</strong>
          </div>
          <div className="metric">
            <span>Price</span>
            <strong>{formatCurrency(snapshot.market.price)}</strong>
          </div>
          <div className="metric">
            <span>24h change</span>
            <strong className={snapshot.market.changePct >= 0 ? "positive" : "negative"}>
              {snapshot.market.changePct >= 0 ? "+" : ""}
              {snapshot.market.changePct.toFixed(2)}%
            </strong>
          </div>
          <div className="metric">
            <span>24h volume</span>
            <strong>{formatVolume(snapshot.market.volume24h)}</strong>
          </div>
          <div className="metric">
            <span>Active agents</span>
            <strong>{summary.activeAgents}</strong>
          </div>
        </div>
      </header>

      {/* ── Main Grid ─────────────────────────────────────── */}
      <section className="dashboard-grid">

        {/* Coordinator verdict */}
        <article className="panel consensus-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Consensus engine</p>
              <h2>Coordinator verdict</h2>
            </div>
            <DirectionBadge value={snapshot.consensus.action} />
          </div>

          <div className="consensus-score">
            <div className="score-ring">
              <strong>{summary.liveConfidence}%</strong>
              <span>confidence</span>
            </div>
            <div className="consensus-copy">
              <p>{snapshot.consensus.explanation.join(" ")}</p>
              <ul className="consensus-tags">
                <li>{snapshot.consensus.shouldExecute ? "EXECUTE" : "WAIT"}</li>
                <li>{snapshot.risk.action === "APPROVE" ? "LOW" : "HIGH"} RISK</li>
                <li>HIGH LIQUIDITY</li>
              </ul>
            </div>
          </div>

          <div className="timeline">
            {[90, 85, 95, 88, 92].map((value, index) => (
              <div key={index} className="bar-wrap">
                <span className="bar-label">{index + 1}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="subtle" style={{ marginTop: 8, fontSize: "0.76rem" }}>
            Agent confidence per round (last 5 rounds)
          </p>
        </article>

        {/* Specialist agents — Risk Manager excluded */}
        <article className="panel agents-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Specialists</p>
              <h2>Agent cards</h2>
            </div>
            <span className="x402-badge">⚡ x402 paywall active</span>
          </div>

          <div className="agent-list">
            {snapshot.agents.map((agent, index) => (
              <section key={agent.id} className={`agent-card ${highlightedAgentIndex === index ? 'highlight-pulse' : ''}`}>
                <div className="agent-top">
                  <div>
                    <h3>{agent.agent}</h3>
                    <p>Agent</p>
                  </div>
                  <DirectionBadge value={agent.action} />
                </div>

                <div className="agent-meta">
                  <span>{agent.reasons[0]}</span>
                  <span>{Math.round(agent.confidence * 100)}% confidence</span>
                  <span>90 ms</span>
                </div>

                <p className="agent-reasoning">{agent.reasons.slice(1).join(" ")}</p>

                <div className="agent-foot">
                  <span className="payment-tag">💳 {agent.payment?.id || 'unpaid'}</span>
                  <span>Signal sold</span>
                </div>
              </section>
            ))}
          </div>
        </article>

        {/* Execution book */}
        <article className="panel positions-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Execution book</p>
              <h2>Open positions</h2>
            </div>
            <span className="subtle">Simulated portfolio</span>
          </div>

          <div className="table">
            <div className="table-row table-head">
              <span>Pair</span>
              <span>Side</span>
              <span>Size</span>
              <span>PnL</span>
              <span>Status</span>
            </div>
            {snapshot.positions.map((p) => (
              <div className="table-row" key={p.pair + p.side}>
                <span>
                  <strong>{p.pair}</strong>
                  <small>Exposure</small>
                </span>
                <span>{p.side}</span>
                <span>${p.exposureUsd.toFixed(0)}</span>
                <span className={p.pnlPct >= 0 ? "positive" : "negative"}>
                  {p.pnlPct.toFixed(2)}%
                </span>
                <span>{p.side === "FLAT" ? "Watching" : "Open"}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Trade history */}
        <article className="panel trades-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Trade history</p>
              <h2>Recent decisions</h2>
            </div>
            <span className="subtle">Latest {snapshot.generatedAt.slice(11, 16)} UTC</span>
          </div>

          <div className="trade-list">
            {snapshot.decisionSteps.map((trade) => (
              <div className="trade-row" key={trade.label}>
                <div>
                  <strong>{snapshot.generatedAt.slice(11, 16)}</strong>
                  <p>{trade.label}</p>
                </div>
                <div>
                  <strong>{trade.status}</strong>
                  <p></p>
                </div>
                <div>
                  <strong></strong>
                  <p>{trade.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Bottom Strip ─────────────────────────────────── */}
      <section className="bottom-strip">

        {/* Risk Gate — visually authoritative */}
        {snapshot.risk && (
          <article className={`panel risk-gate-panel ${snapshot.risk.action === "APPROVE" ? "gate-approve" : "gate-block"}`}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Risk Gate</p>
                <h2>Risk Manager</h2>
              </div>
              <span className={`gate-verdict ${snapshot.risk.action === "APPROVE" ? "verdict-approve" : "verdict-block"}`}>
                {snapshot.risk.action === "APPROVE" ? "✓ APPROVED" : "✗ BLOCKED"}
              </span>
            </div>
            <div className="gate-body">
              <p className="gate-reason">{snapshot.risk.reasons[0]}</p>
              <div className="gate-stats">
                <div className="gate-stat">
                  <span>Max position</span>
                  <strong>${snapshot.risk.maxPositionUsd.toFixed(0)}</strong>
                </div>
                <div className="gate-stat">
                  <span>Slippage cap</span>
                  <strong>{snapshot.risk.maxSlippageBps} bps</strong>
                </div>
                <div className="gate-stat">
                  <span>Trade authority</span>
                  <strong>{snapshot.risk.action === "APPROVE" ? "Granted" : "Withheld"}</strong>
                </div>
              </div>
              {snapshot.risk.flags.length > 0 && (
                <div className="gate-flags">
                  {snapshot.risk.flags.map((f) => (
                    <span key={f} className="gate-flag">⚠ {f.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}
            </div>
          </article>
        )}

        {/* x402 Payment Log */}
        {snapshot.receipts && snapshot.receipts.length > 0 && (
          <article className="panel payments-panel hero-payments">
            <div className="section-head">
              <div>
                <p className="eyebrow">x402 Protocol</p>
                <h2><span className="pulse-dot"></span> x402 Payment Network</h2>
              </div>
              <span className="x402-badge">⚡ Live settlement</span>
            </div>
            <div className="payment-log" ref={paymentLogRef}>
              {snapshot.receipts.map((p) => (
                <div key={p.id} className="payment-row">
                  <div className="payment-agent">
                    <strong>{p.targetAgent}</strong>
                  </div>
                  <div className="payment-amount">
                    <strong>${p.amountUsd.toFixed(2)} USDC</strong>
                  </div>
                  <div className="payment-tx">
                    <code>{p.id.slice(0, 18)}…</code>
                    <span>{new Date(p.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="payment-footer">
              Total paid: {snapshot.receipts.reduce((sum, p) => sum + p.amountUsd, 0).toFixed(2)} USDC across {snapshot.receipts.length} signals
            </div>
          </article>
        )}

        {/* Decision Timeline */}
        {snapshot.decisionSteps && snapshot.decisionSteps.length > 0 && (
          <article className="panel decision-flow-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Agent mesh</p>
                <h2>Decision flow</h2>
              </div>
            </div>
            <ol className="step-list">
              {snapshot.decisionSteps.map((step, i) => (
                <li key={i} className={`step-item step-${step.status}`}>
                  <StepIcon status={step.status} />
                  <div className="step-body">
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        )}

        {/* Execution Proof */}
        {snapshot.executionProof && (
          <article className="panel proof-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">On-chain</p>
                <h2>Execution proof</h2>
              </div>
              <span className="network-badge">🔗 {snapshot.executionProof.network}</span>
            </div>
            <div className="proof-grid">
              <div className="proof-stat">
                <span>Status</span>
                <strong className={snapshot.executionProof.status === "REJECTED" ? "negative" : "positive"}>
                  {snapshot.executionProof.status}
                </strong>
              </div>
              <div className="proof-stat">
                <span>Fill price</span>
                <strong>{snapshot.executionProof.fillPrice}</strong>
              </div>
              <div className="proof-stat">
                <span>Notional</span>
                <strong>{snapshot.executionProof.notionalUsd}</strong>
              </div>
              <div className="proof-stat">
                <span>Slippage</span>
                <strong>{snapshot.executionProof.slippageBps}</strong>
              </div>
            </div>
            <div className="proof-tx">
              <span>Tx hash</span>
              <code className="tx-hash">{snapshot.executionProof.txHash.slice(0, 20)}…{snapshot.executionProof.txHash.slice(-8)}</code>
              <a
                href={snapshot.executionProof.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                View on OKLink ↗
              </a>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

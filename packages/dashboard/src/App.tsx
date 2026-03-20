import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardSnapshot } from "./types";
import { loadDashboardSnapshot, refreshSnapshot, driftPrice } from "./lib/mockApi";

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
  const tickRef = useRef(0);

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

  // Manual "Run agents" trigger
  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      const fresh = await refreshSnapshot();
      if (fresh) setSnapshot(fresh);
    } finally {
      setRunning(false);
    }
  }, []);

  const summary = useMemo(() => {
    if (!snapshot) return null;
    const activeAgents = snapshot.agents.filter(
      (a) => a.direction === "LONG" || a.direction === "SHORT"
    ).length;
    const liveConfidence = Math.round(snapshot.consensus.weightedConfidence * 100);
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
          <p className="eyebrow">Signal Swarm / X Layer</p>
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
            {running ? "Computing…" : "▶ Run agents"}
          </button>
          <span className="last-updated">
            Last computed: {new Date(snapshot.lastUpdated).toLocaleTimeString()}
          </span>
        </div>

        <div className="hero-metrics">
          <div className="metric">
            <span>Market</span>
            <strong>{snapshot.market.symbol}</strong>
          </div>
          <div className="metric">
            <span>Price</span>
            <strong>{formatCurrency(snapshot.market.price)}</strong>
          </div>
          <div className="metric">
            <span>24h change</span>
            <strong className={snapshot.market.change24h >= 0 ? "positive" : "negative"}>
              {snapshot.market.change24h >= 0 ? "+" : ""}
              {snapshot.market.change24h.toFixed(2)}%
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
            <DirectionBadge value={snapshot.consensus.direction} />
          </div>

          <div className="consensus-score">
            <div className="score-ring">
              <strong>{summary.liveConfidence}%</strong>
              <span>confidence</span>
            </div>
            <div className="consensus-copy">
              <p>{snapshot.consensus.reasoning}</p>
              <ul className="consensus-tags">
                <li>{snapshot.consensus.shouldExecute ? "EXECUTE" : "WAIT"}</li>
                <li>{snapshot.consensus.riskLevel.toUpperCase()} RISK</li>
                <li>{snapshot.market.liquidity.toUpperCase()} LIQUIDITY</li>
              </ul>
            </div>
          </div>

          <div className="timeline">
            {snapshot.timeline.map((value, index) => (
              <div key={index} className="bar-wrap">
                <span className="bar-label">{index + 1}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="subtle" style={{ marginTop: 8, fontSize: "0.76rem" }}>
            Agent confidence per round (last {snapshot.timeline.length} rounds)
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
            {snapshot.agents.map((agent) => (
              <section key={agent.id} className="agent-card">
                <div className="agent-top">
                  <div>
                    <h3>{agent.name}</h3>
                    <p>{agent.role}</p>
                  </div>
                  <DirectionBadge value={agent.direction} />
                </div>

                <div className="agent-meta">
                  <span>{agent.signal}</span>
                  <span>{Math.round(agent.confidence * 100)}% confidence</span>
                  <span>{agent.latencyMs} ms</span>
                </div>

                <p className="agent-reasoning">{agent.reasoning}</p>

                <div className="agent-foot">
                  <span className="payment-tag">💳 {agent.paidWith}</span>
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
              <div className="table-row" key={p.symbol + p.side}>
                <span>
                  <strong>{p.symbol}</strong>
                  <small>Entry {p.entry} / Stop {p.stop}</small>
                </span>
                <span>{p.side}</span>
                <span>{p.size}</span>
                <span className={p.pnl.startsWith("+") ? "positive" : "negative"}>
                  {p.pnl}
                </span>
                <span>{p.status}</span>
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
            <span className="subtle">Latest {snapshot.lastUpdated.slice(11, 16)} UTC</span>
          </div>

          <div className="trade-list">
            {snapshot.trades.map((trade) => (
              <div className="trade-row" key={`${trade.time}-${trade.symbol}-${trade.action}`}>
                <div>
                  <strong>{trade.time}</strong>
                  <p>{trade.symbol}</p>
                </div>
                <div>
                  <strong>{trade.action}</strong>
                  <p>{trade.size}</p>
                </div>
                <div>
                  <strong>{trade.result}</strong>
                  <p>{trade.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Bottom Strip ─────────────────────────────────── */}
      <section className="bottom-strip">

        {/* Risk Gate — visually authoritative */}
        {snapshot.riskGate && (
          <article className={`panel risk-gate-panel ${snapshot.riskGate.action === "APPROVE" ? "gate-approve" : "gate-block"}`}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Risk Gate</p>
                <h2>Risk Manager</h2>
              </div>
              <span className={`gate-verdict ${snapshot.riskGate.action === "APPROVE" ? "verdict-approve" : "verdict-block"}`}>
                {snapshot.riskGate.action === "APPROVE" ? "✓ APPROVED" : "✗ BLOCKED"}
              </span>
            </div>
            <div className="gate-body">
              <p className="gate-reason">{snapshot.riskGate.reason}</p>
              <div className="gate-stats">
                <div className="gate-stat">
                  <span>Max position</span>
                  <strong>${snapshot.riskGate.maxPositionUsd.toFixed(0)}</strong>
                </div>
                <div className="gate-stat">
                  <span>Slippage cap</span>
                  <strong>{snapshot.riskGate.maxSlippageBps} bps</strong>
                </div>
                <div className="gate-stat">
                  <span>Trade authority</span>
                  <strong>{snapshot.riskGate.action === "APPROVE" ? "Granted" : "Withheld"}</strong>
                </div>
              </div>
              {snapshot.riskGate.flags.length > 0 && (
                <div className="gate-flags">
                  {snapshot.riskGate.flags.map((f) => (
                    <span key={f} className="gate-flag">⚠ {f.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}
            </div>
          </article>
        )}

        {/* x402 Payment Log */}
        {snapshot.payments && snapshot.payments.length > 0 && (
          <article className="panel payments-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">x402 Protocol</p>
                <h2>Payment log</h2>
              </div>
              <span className="x402-badge">⚡ Simulated settlement</span>
            </div>
            <div className="payment-log">
              {snapshot.payments.map((p) => (
                <div key={p.txId} className="payment-row">
                  <div className="payment-agent">
                    <strong>{p.agentName}</strong>
                    <span>coordinator → {p.agentId}</span>
                  </div>
                  <div className="payment-amount">
                    <strong>${p.amountUsd.toFixed(2)} USDC</strong>
                    <span className="payment-status">✓ {p.status}</span>
                  </div>
                  <div className="payment-tx">
                    <code>{p.txId.slice(0, 22)}…</code>
                    <span>{new Date(p.settledAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
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

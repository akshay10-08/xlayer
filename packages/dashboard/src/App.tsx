import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot } from "./types";
import { evolveSnapshot, loadDashboardSnapshot } from "./lib/mockApi";

const statusPill = (ok: boolean) => (ok ? "EXECUTE" : "WAIT");

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
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

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isReady = snapshot !== null;

  useEffect(() => {
    let mounted = true;

    loadDashboardSnapshot()
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    let tick = 0;
    const interval = window.setInterval(() => {
      tick += 1;
      setSnapshot((current) => (current ? evolveSnapshot(current, tick) : current));
    }, 4500);

    return () => window.clearInterval(interval);
  }, [isReady]);

  const summary = useMemo(() => {
    if (!snapshot) return null;

    const activeAgents = snapshot.agents.filter((agent) => agent.direction === "LONG" || agent.direction === "SHORT").length;
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
          <p>Bootstrapping mock market data, consensus state, and execution trace.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Signal Swarm / X Layer</p>
          <h1>Multi-agent trading intelligence with paid signal exchange.</h1>
          <p className="lede">
            Specialist agents price their own views, the coordinator weights consensus, and
            execution only clears when risk says the route is safe.
          </p>
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

      <section className="dashboard-grid">
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
                <li>{statusPill(snapshot.consensus.shouldExecute)}</li>
                <li>{snapshot.consensus.riskLevel.toUpperCase()} RISK</li>
                <li>{snapshot.market.liquidity.toUpperCase()} LIQUIDITY</li>
              </ul>
            </div>
          </div>

          <div className="timeline">
            {snapshot.timeline.map((value, index) => (
              <div key={`${index}-${value}`} className="bar-wrap">
                <span className="bar-label">{index + 1}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel agents-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Specialists</p>
              <h2>Agent cards</h2>
            </div>
            <span className="subtle">x402 paywall enabled</span>
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
                  <span>{agent.paidWith}</span>
                  <span>Signal sold</span>
                </div>
              </section>
            ))}
          </div>
        </article>

        <article className="panel positions-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Execution book</p>
              <h2>Open positions</h2>
            </div>
            <span className="subtle">Mock portfolio</span>
          </div>

          <div className="table">
            <div className="table-row table-head">
              <span>Pair</span>
              <span>Side</span>
              <span>Size</span>
              <span>PnL</span>
              <span>Status</span>
            </div>
            {snapshot.positions.map((position) => (
              <div className="table-row" key={position.symbol + position.side}>
                <span>
                  <strong>{position.symbol}</strong>
                  <small>
                    Entry {position.entry} / Stop {position.stop}
                  </small>
                </span>
                <span>{position.side}</span>
                <span>{position.size}</span>
                <span className={position.pnl.startsWith("+") ? "positive" : "negative"}>
                  {position.pnl}
                </span>
                <span>{position.status}</span>
              </div>
            ))}
          </div>
        </article>

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
    </main>
  );
}

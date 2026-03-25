import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "./types";
import { analyzeSymbol } from "./lib/mockApi";
import WalletButton from "./components/WalletButton";

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "landing" | "loading" | "results";
type RiskLevel = "safe" | "balanced" | "degen";
const PAIRS = ["OKB/USDC", "ETH/USDC", "BTC/USDC", "SOL/USDC"] as const;
type Pair = (typeof PAIRS)[number];

// ─── Plain-English Translators ────────────────────────────────────────────────
function technicalToText(reasons: string[]): string {
  const r = reasons.join(" ").toLowerCase();
  if (r.includes("bearish") || r.includes("rsi") && r.includes("below"))
    return "Price is below key averages — momentum looks weak right now.";
  if (r.includes("bullish") || r.includes("above"))
    return "Price is above key averages — momentum is building.";
  return "Technical indicators are mixed — market is ranging sideways.";
}

function whaleToText(reasons: string[]): string {
  const r = reasons.join(" ").toLowerCase();
  if (r.includes("negative") || r.includes("selling") || r.includes("distribution"))
    return "Big wallets are quietly offloading their bags.";
  if (r.includes("positive") || r.includes("accumul"))
    return "Big wallets are quietly accumulating — smart money is buying.";
  return "Whale activity is neutral — no strong buying or selling signals.";
}

function sentimentToText(reasons: string[]): string {
  const r = reasons.join(" ").toLowerCase();
  if (r.includes("bearish") || r.includes("fear") || r.includes("negative"))
    return "Community mood is cautious — some fear in the market.";
  if (r.includes("bullish") || r.includes("excitement") || r.includes("positive"))
    return "Community is excited — lots of bullish chatter online.";
  return "Social sentiment is neutral — hype is cooling down a little.";
}

function agentToText(agentId: string, reasons: string[]): string {
  if (agentId === "technical") return technicalToText(reasons);
  if (agentId === "whale") return whaleToText(reasons);
  return sentimentToText(reasons);
}

function verdictSummary(explanation: string[]): string {
  const raw = explanation.join(" ");
  const match = raw.match(/(\d+\/\d+) aligned agents/);
  const aligned = match ? match[1] : "2/3";
  const action = raw.toLowerCase().includes("long") || raw.toLowerCase().includes("buy")
    ? "buying" : raw.toLowerCase().includes("short") || raw.toLowerCase().includes("sell")
    ? "selling" : "holding";
  return `${aligned} agents agree the market is ripe for ${action}. The signal is strong enough for the coordinator to act.`;
}

function riskToText(flags: string[]): { ok: boolean; label: string }[] {
  const checks = [
    { key: "HIGH_SLIPPAGE", label: "Slippage safe", invert: true },
    { key: "LOW_CONFIDENCE", label: "Confidence OK", invert: true },
    { key: "HIGH_VOLATILITY", label: "Volatility low", invert: true },
    { key: "SPREAD_OK", label: "Spread OK", invert: false },
  ];
  const upperFlags = flags.map((f) => f.toUpperCase());
  return checks.map((c) => ({
    label: c.label,
    ok: c.invert ? !upperFlags.some((f) => f.includes(c.key.split("_")[1]!)) : true,
  }));
}

function verdictColor(action: string) {
  if (action === "BUY") return "#00e676";
  if (action === "SELL") return "#ff8c97";
  return "#ffd54f";
}

function verdictEmoji(action: string) {
  if (action === "BUY") return "🟢";
  if (action === "SELL") return "🔴";
  return "🟡";
}

function agentIcon(agentId: string) {
  if (agentId === "technical") return "📈";
  if (agentId === "whale") return "🐋";
  return "😌";
}

function agentLabel(agentId: string) {
  if (agentId === "technical") return "Technical";
  if (agentId === "whale") return "Whale Tracker";
  return "Sentiment";
}

// ─── Loading Steps ────────────────────────────────────────────────────────────
const LOADING_STEPS = [
  { delay: 400, text: "🤖 Waking up agents..." },
  { delay: 900, text: "💸 Dispatching x402 payments..." },
  { delay: 1500, text: "📊 Agents are analyzing the market..." },
  { delay: 2400, text: "🧠 Coordinator is deciding..." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function LoadingScreen({ pair }: { pair: Pair }) {
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const pairLabel = pair;

  useEffect(() => {
    const timers = LOADING_STEPS.map((s, i) =>
      window.setTimeout(() => setVisibleSteps((prev) => [...prev, i]), s.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main className="shell center loading-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="loading-card">
        <div className="loading-logo pulse-ring">⚡ SIGNAL SWARM</div>
        <p className="loading-pair">Analyzing {pairLabel}</p>
        <div className="loading-steps">
          {LOADING_STEPS.map((s, i) => (
            <div
              key={i}
              className={`loading-step ${visibleSteps.includes(i) ? "step-visible" : ""}`}
            >
              {s.text}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function LandingScreen({
  onSubmit,
}: {
  onSubmit: (pair: Pair, risk: RiskLevel) => void;
}) {
  const [pair, setPair] = useState<Pair>("OKB/USDC");
  const [risk, setRisk] = useState<RiskLevel>("balanced");

  return (
    <main className="shell center landing-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="landing-outer">
        <div className="wallet-topbar">
          <WalletButton />
        </div>

        <div className="landing-card">
          <div className="landing-logo">⚡ SIGNAL SWARM</div>
          <p className="landing-subtitle">Ask our AI agents what to trade</p>

          <div className="field-group">
            <label className="field-label">🔍 Which pair?</label>
            <select
              className="pair-select"
              value={pair}
              onChange={(e) => setPair(e.target.value as Pair)}
            >
              {PAIRS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label">🛡️ Your risk level?</label>
            <div className="risk-options">
              {(
                [
                  ["safe", "Safe 🐢"],
                  ["balanced", "Balanced ⚖️"],
                  ["degen", "Degen 🚀"],
                ] as [RiskLevel, string][]
              ).map(([value, label]) => (
                <label key={value} className={`risk-option ${risk === value ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="risk"
                    value={value}
                    checked={risk === value}
                    onChange={() => setRisk(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button className="ask-btn" onClick={() => onSubmit(pair, risk)}>
            🔮 Ask the Swarm
          </button>

          <div className="or-divider">── or ──</div>

          <WalletButton variant="inline" />
        </div>

        <p className="landing-tagline">
          3 specialist AI agents · paid signal mesh · x402 protocol
        </p>
      </div>
    </main>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({
  snapshot,
  pair,
  isDemoMode,
  onReset,
}: {
  snapshot: DashboardSnapshot;
  pair: Pair;
  isDemoMode: boolean;
  onReset: () => void;
}) {
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  useEffect(() => {
    snapshot.agents.forEach((_, i) => {
      window.setTimeout(
        () => setVisibleCards((prev) => [...prev, i]),
        200 + i * 220
      );
    });
  }, [snapshot.agents]);

  const verdict = snapshot.consensus.action;
  const confidence = Math.round(snapshot.consensus.finalScore * 100);
  const price = snapshot.market.price;
  const changePct = snapshot.market.changePct;
  const summary = verdictSummary(snapshot.consensus.explanation);
  const totalPaid = (snapshot.receipts ?? []).reduce(
    (s, r) => s + r.amountUsd,
    0
  );
  const riskChecks = riskToText(snapshot.risk?.flags ?? []);
  const isBlocked = snapshot.risk?.action === "BLOCK";

  const shareText = encodeURIComponent(
    `Just asked 3 AI agents about ${pair} on @SignalSwarm ⚡\nVerdict: ${verdictEmoji(verdict)} ${verdict} · ${confidence}% confidence · x402-powered signal mesh\nAgents paid each other $${totalPaid.toFixed(2)} USDC for these signals\n#XLayer #x402 #AIAgents`
  );
  const tweetUrl = `https://twitter.com/intent/tweet?text=${shareText}`;

  return (
    <main className="shell results-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="results-top-bar">
        <span className="results-logo">⚡ SIGNAL SWARM</span>
        <div className="results-topbar-right">
          {isDemoMode && <span className="demo-badge">⚡ Demo mode</span>}
          <WalletButton />
        </div>
      </div>

      {/* SECTION A — VERDICT */}
      <section className="verdict-section">
        <div className="verdict-pair-row">
          <span className="verdict-pair">{pair}</span>
          <span className="verdict-price">${price.toFixed(4)}</span>
          <span className={`verdict-change ${changePct >= 0 ? "positive" : "negative"}`}>
            {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}% today
          </span>
        </div>
        <div className="verdict-card">
          <div
            className="verdict-action"
            style={{ color: verdictColor(verdict) }}
          >
            {verdictEmoji(verdict)} {verdict}
          </div>
          <div className="verdict-confidence">{confidence}% confidence</div>
          <p className="verdict-summary">"{summary}"</p>
        </div>
      </section>

      {/* SECTION B — AGENT CARDS */}
      <section className="agents-section">
        <h2 className="section-title">What each agent thinks</h2>
        <div className="agent-grid">
          {snapshot.agents.map((agent, i) => {
            const payment = snapshot.receipts?.find(
              (r) => r.targetAgent === agent.agent
            );
            return (
              <div
                key={agent.id}
                className={`agent-result-card ${visibleCards.includes(i) ? "card-visible" : ""}`}
              >
                <div className="arc-header">
                  <span className="arc-icon">{agentIcon(agent.agent)}</span>
                  <span className="arc-label">{agentLabel(agent.agent)}</span>
                  <span
                    className="arc-action"
                    style={{ color: verdictColor(agent.action) }}
                  >
                    {verdictEmoji(agent.action)} {agent.action}
                  </span>
                </div>
                <div className="arc-confidence">
                  {Math.round(agent.confidence * 100)}% sure
                </div>
                <p className="arc-text">"{agentToText(agent.agent, agent.reasons)}"</p>
                {payment && (
                  <div className="arc-payment">
                    💸 Paid ${payment.amountUsd.toFixed(2)} USDC
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION C — RISK CHECK */}
      <section className="risk-section">
        <h2 className="section-title">Risk Check</h2>
        <div className="risk-row">
          {riskChecks.map((c) => (
            <span key={c.label} className={`risk-chip ${c.ok ? "chip-ok" : "chip-fail"}`}>
              {c.ok ? "✅" : "❌"} {c.label}
            </span>
          ))}
        </div>
        {isBlocked && (
          <div className="risk-warning">
            ⚠️ <strong>Heads up:</strong> Our risk manager flagged this trade. Slippage or
            confidence was too high to execute safely. Agents still gave their verdict, but
            trade execution was paused.
          </div>
        )}
      </section>

      {/* SECTION D — x402 RECEIPT */}
      <section className="receipt-section">
        <button
          className="receipt-toggle"
          onClick={() => setReceiptOpen((o) => !o)}
        >
          💸 How agents got paid {receiptOpen ? "▲" : "▼"}
        </button>
        {receiptOpen && (
          <div className="receipt-body">
            {(snapshot.receipts ?? []).map((r) => (
              <div key={r.id} className="receipt-row">
                <span className="receipt-agent">{r.targetAgent} agent</span>
                <span className="receipt-amount">${r.amountUsd.toFixed(2)} USDC</span>
                <span className="receipt-ref">ref: {r.id.slice(0, 18)}</span>
              </div>
            ))}
            <div className="receipt-total">
              Total: ${totalPaid.toFixed(2)} USDC across{" "}
              {snapshot.receipts?.length ?? 0} signals
            </div>
            {snapshot.executionProof?.explorerUrl && (
              <a
                href={snapshot.executionProof.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="oklink-btn"
              >
                🔗 View execution on OKLink ↗
              </a>
            )}
          </div>
        )}
      </section>

      {/* SECTION E — ACTIONS */}
      <section className="actions-section">
        <button className="action-btn secondary" onClick={onReset}>
          🔄 Analyze another pair
        </button>
        <a
          className="action-btn primary"
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          📤 Share this signal
        </a>
      </section>
    </main>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [selectedPair, setSelectedPair] = useState<Pair>("OKB/USDC");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const fetchedRef = useRef(false);

  const handleAsk = useCallback(async (pair: Pair, _risk: RiskLevel) => {
    setSelectedPair(pair);
    setPhase("loading");
    fetchedRef.current = false;

    try {
      const { data, demo } = await analyzeSymbol(pair, _risk);
      setSnapshot(data);
      setIsDemoMode(demo);
    } catch {
      setIsDemoMode(true);
    }

    // Minimum 3s loading for the animation to play out
    await new Promise((r) => setTimeout(r, 3000));
    setPhase("results");
  }, []);

  const handleReset = useCallback(() => {
    setPhase("landing");
    setSnapshot(null);
  }, []);

  if (phase === "landing") return <LandingScreen onSubmit={handleAsk} />;
  if (phase === "loading") return <LoadingScreen pair={selectedPair} />;
  if (phase === "results" && snapshot)
    return (
      <ResultsScreen
        snapshot={snapshot}
        pair={selectedPair}
        isDemoMode={isDemoMode}
        onReset={handleReset}
      />
    );

  // Fallback if still loading
  return <LoadingScreen pair={selectedPair} />;
}

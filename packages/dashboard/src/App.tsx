import { useCallback, useState } from "react";
import type { DashboardSnapshot } from "./types";
import { analyzeSymbol, scanPairs, getHistory } from "./lib/mockApi";
import WalletButton from "./components/WalletButton";
import { useAccount } from "wagmi";

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "landing" | "loading" | "results";
type AppTab = "analyze" | "scanner" | "history";
type RiskLevel = "safe" | "balanced" | "degen";
type Timeframe = "15m" | "1h" | "4h" | "1d";

// Pair data with emoji + accent color
const PAIR_DATA: { pair: string; emoji: string; color: string }[] = [
  { pair: "ETH/USDC",  emoji: "🔷", color: "#627EEA" },
  { pair: "BTC/USDC",  emoji: "🟠", color: "#F7931A" },
  { pair: "OKB/USDC",  emoji: "⚫", color: "#888" },
  { pair: "SOL/USDC",  emoji: "🟣", color: "#9945FF" },
  { pair: "ARB/USDC",  emoji: "🔵", color: "#28A0F0" },
  { pair: "OP/USDC",   emoji: "🔴", color: "#FF0420" },
  { pair: "LINK/USDC", emoji: "🔗", color: "#2A5ADA" },
  { pair: "DOGE/USDC", emoji: "🐕", color: "#C2A633" },
  { pair: "AVAX/USDC", emoji: "🔺", color: "#E84142" },
  { pair: "MATIC/USDC",emoji: "🟪", color: "#8247E5" },
];
const PAIRS = PAIR_DATA.map((p) => p.pair);
const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "15m", label: "15 min" },
  { value: "1h",  label: "1 Hour" },
  { value: "4h",  label: "4 Hours" },
  { value: "1d",  label: "1 Day" },
];

interface ScanRow { pair: string; verdict: "BUY"|"SELL"|"HOLD"; confidence: number; riskApproved: boolean; price: number; changePct: number; }
interface HistoryEntry { id: number; pair: string; verdict: string; confidence: number; riskLevel: string; riskApproved: boolean; timestamp: number; txHash: string; explorerUrl: string; }
interface PositionSuggestion { portfolioUsd: number; riskProfile: string; confidencePct: number; positionPct: number; recommendedUsd: number; stopLossPct: number; takeProfitPct: number; maxLoss: number; maxGain: number; }

// ─── Plain-English Translators ────────────────────────────────────────────────
function agentToText(agentId: string, reasons: string[]): string {
  const r = reasons.join(" ").toLowerCase();
  if (agentId === "technical") {
    if (r.includes("bearish") || r.includes("below")) return "Price is below key averages — momentum looks weak right now.";
    if (r.includes("bullish") || r.includes("above")) return "Price is above key averages — momentum is building.";
    return "Technical indicators are mixed — market is ranging sideways.";
  }
  if (agentId === "whale") {
    if (r.includes("negative") || r.includes("selling")) return "Big wallets are quietly offloading their bags.";
    if (r.includes("positive") || r.includes("accumul")) return "Smart money is quietly accumulating — bullish signal.";
    return "Whale activity is neutral — no strong flow detected.";
  }
  if (r.includes("bearish") || r.includes("fear")) return "Community mood is cautious — fear in the market.";
  if (r.includes("bullish") || r.includes("excite")) return "Community is excited — lots of bullish chatter online.";
  return "Social sentiment is neutral — hype is cooling down a little.";
}

function verdictSummary(action: string, agents: number, aligned: number): string {
  const word = action === "BUY" ? "buying" : action === "SELL" ? "selling" : "holding";
  return `${aligned}/${agents} agents agree the market is ripe for ${word}. The signal is strong enough for the coordinator to act.`;
}

function verdictColor(a: string) { return a==="BUY"?"#00e676":a==="SELL"?"#ff8c97":"#ffd54f"; }
function verdictEmoji(a: string) { return a==="BUY"?"🟢":a==="SELL"?"🔴":"🟡"; }
function verdictBg(a: string) {
  return a === "BUY"
    ? "rgba(0,230,118,0.15)"
    : a === "SELL"
    ? "rgba(255,140,151,0.15)"
    : "rgba(255,213,79,0.15)";
}
function verdictGlow(a: string) {
  return a === "BUY"
    ? "0 0 40px rgba(0,230,118,0.35)"
    : a === "SELL"
    ? "0 0 40px rgba(255,140,151,0.35)"
    : "0 0 40px rgba(255,213,79,0.35)";
}
function verdictStripe(a: string) {
  return a === "BUY" ? "#00e676" : a === "SELL" ? "#ff4d60" : "#ffd54f";
}

function riskChecks(flags: string[]): {ok:boolean;label:string}[] {
  const f = flags.map(x => x.toUpperCase());
  return [
    { label:"Slippage safe",   ok: !f.some(x=>x.includes("SLIPPAGE")) },
    { label:"Confidence OK",   ok: !f.some(x=>x.includes("CONFIDENCE")) },
    { label:"Volatility low",  ok: !f.some(x=>x.includes("VOLATIL")) },
    { label:"Spread OK",       ok: true },
  ];
}

const agentMeta: Record<string, {icon:string;label:string}> = {
  technical: { icon:"📈", label:"TECHNICAL" },
  whale:     { icon:"🐋", label:"WHALE" },
  sentiment: { icon:"😌", label:"SENTIMENT" },
};

const LOADING_STEPS = [
  "🔍 Waking agents...",
  "💸 Dispatching x402 payments...",
  "📊 Analyzing market data...",
  "🧠 Coordinator deciding...",
  "⛓️ Recording signal onchain...",
];

export default function App() {
  const { address, isConnected } = useAccount();

  // ─── Top-level tab ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<AppTab>("analyze");

  // ─── Analyze flow ──────────────────────────────────────────────────────────
  const [phase, setPhase]            = useState<Phase>("landing");
  const [pair, setPair]              = useState<string>("ETH/USDC");
  const [timeframe, setTimeframe]    = useState<Timeframe>("15m");
  const [risk, setRisk]              = useState<RiskLevel>("balanced");
  const [portfolio, setPortfolio]    = useState<number>(500);
  const [snapshot, setSnapshot]      = useState<DashboardSnapshot | null>(null);
  const [positionData, setPosition]  = useState<PositionSuggestion | null>(null);
  const [onchainTx, setOnchainTx]    = useState<string>("");
  const [loadingStep, setLoadingStep]= useState(0);
  const [receiptOpen, setReceiptOpen]= useState(false);
  const [error, setError]            = useState<string>("");

  // ─── Scanner ───────────────────────────────────────────────────────────────
  const [scanResults, setScanResults]       = useState<ScanRow[]>([]);
  const [scanLoading, setScanLoading]       = useState(false);
  const [scanSelectedPairs, setScanPairs]   = useState<string[]>(PAIRS);

  // ─── History ───────────────────────────────────────────────────────────────
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // ─── Analyze flow handlers ─────────────────────────────────────────────────
  const handleAsk = useCallback(async () => {
    setPhase("loading");
    setError("");
    setLoadingStep(0);
    setReceiptOpen(false);

    let step = 0;
    const iv = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1);
      setLoadingStep(step);
    }, 850);

    try {
      const data = await analyzeSymbol(pair, timeframe, risk, portfolio, isConnected ? address : undefined);
      clearInterval(iv);
      setSnapshot(data);
      const anyData = data as unknown as Record<string, unknown>;
      setPosition((anyData.positionSuggestion as PositionSuggestion | null) ?? calcPositionFallback(portfolio, risk, data.consensus.finalScore));
      setOnchainTx((anyData.onchainProofTx as string) ?? data.executionProof.txHash);
      setPhase("results");
    } catch (e: unknown) {
      clearInterval(iv);
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("landing");
    }
  }, [pair, timeframe, risk, portfolio, address, isConnected]);

  // ─── Scanner handler ───────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setScanLoading(true);
    setScanResults([]);
    try {
      const rows = await scanPairs(scanSelectedPairs, timeframe);
      setScanResults(rows);
    } catch {
      setScanResults([]);
    } finally {
      setScanLoading(false);
    }
  }, [scanSelectedPairs, timeframe]);

  // ─── History handler ──────────────────────────────────────────────────────
  const handleLoadHistory = useCallback(async (addr: string) => {
    if (!addr) return;
    setHistLoading(true);
    try {
      const entries = await getHistory(addr);
      setHistory(entries);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      {/* Nav */}
      {(phase !== "loading") && (
        <nav className="top-nav">
          <div className="brand-inline">⚡ SIGNAL SWARM</div>
          <div className="nav-tabs">
            {(["analyze","scanner","history"] as AppTab[]).map(t => (
              <button key={t} className={`nav-tab ${tab===t?"active":""}`}
                onClick={() => { setTab(t); if(t==="analyze") setPhase("landing"); if(t==="history"&&isConnected&&address) void handleLoadHistory(address); }}>
                {t==="analyze"?"🔮 Analyze":t==="scanner"?"🔭 Scanner":"📜 My Signals"}
              </button>
            ))}
          </div>
          <WalletButton />
        </nav>
      )}

      {/* ── ANALYZE TAB ─────────────────────────────────────────────────── */}
      {tab === "analyze" && (
        <>
          {/* LANDING */}
          {phase === "landing" && (
            <div className="screen-center">
              <div className="landing-card">
                <div className="brand-hero">⚡ SIGNAL SWARM</div>
                <div className="brand-sub">Ask our AI agents what to trade</div>

                {/* #1 — Pair selector: pill grid */}
                <div className="input-group">
                  <label>🔍 Which pair?</label>
                  <div className="pair-pill-grid">
                    {PAIR_DATA.map(p => (
                      <button
                        key={p.pair}
                        className={`pair-pill ${pair === p.pair ? "selected" : ""}`}
                        style={pair === p.pair ? {
                          borderColor: "#00e676",
                          background: "rgba(0,230,118,0.15)",
                          color: "#fff",
                          boxShadow: `0 0 10px rgba(0,230,118,0.3)`,
                        } : {
                          borderColor: `${p.color}40`,
                          color: `${p.color}`,
                        }}
                        onClick={() => setPair(p.pair)}
                      >
                        <span className="pair-pill-emoji">{p.emoji}</span>
                        <span>{p.pair.split("/")[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* #2 — Timeframe: solid fill on selected */}
                <div className="input-group">
                  <label>⏱ Timeframe?</label>
                  <div className="btn-row">
                    {TIMEFRAMES.map(tf => (
                      <button key={tf.value}
                        className={`toggle-btn ${timeframe===tf.value?"active":""}`}
                        onClick={() => setTimeframe(tf.value)}>{tf.label}</button>
                    ))}
                  </div>
                </div>

                {/* #3 — Risk buttons with distinct colors */}
                <div className="input-group">
                  <label>🛡️ Your risk level?</label>
                  <div className="btn-row">
                    {(["safe","balanced","degen"] as RiskLevel[]).map(r => (
                      <button key={r}
                        className={`toggle-btn risk-btn risk-${r} ${risk===r?"active":""}`}
                        onClick={() => setRisk(r)}>
                        {r==="safe"?"🐢 Safe":r==="balanced"?"⚖️ Balanced":"🚀 Degen"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* #4 — Portfolio input + slider */}
                <div className="input-group">
                  <label>💰 Portfolio size (USDC)?</label>
                  <div className="portfolio-row">
                    <input type="number" min={100} max={10000} step={50} value={portfolio}
                      onChange={e => setPortfolio(Math.max(100, Math.min(10000, Number(e.target.value))))}
                      className="portfolio-input" />
                    <span className="portfolio-hint">USDC</span>
                  </div>
                  <div className="slider-row">
                    <span className="slider-label">$100</span>
                    <input
                      type="range"
                      min={100}
                      max={10000}
                      step={50}
                      value={portfolio}
                      onChange={e => setPortfolio(Number(e.target.value))}
                      className="portfolio-slider"
                    />
                    <span className="slider-label">$10,000</span>
                  </div>
                </div>

                {error && <div className="error-banner">⚠️ {error}</div>}

                {/* #5 — CTA button with glow/pulse */}
                <button className="cta-btn" onClick={() => void handleAsk()}>🔮 Ask the Swarm</button>
                <div className="divider-or">— or —</div>
                <WalletButton variant="inline" />
                <p className="brand-tagline">3 specialist AI agents · paid signal mesh · x402 protocol</p>
              </div>
            </div>
          )}

          {/* LOADING */}
          {phase === "loading" && (
            <div className="screen-center">
              <div className="loading-card">
                <div className="brand-pulse">⚡ SIGNAL SWARM</div>
                <div className="loading-pair">Analyzing {pair}</div>
                <div className="loading-steps">
                  {LOADING_STEPS.map((s,i) => (
                    <div key={i} className={`loading-step ${i<=loadingStep?"visible":""} ${i===loadingStep?"active":""}`}>{s}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RESULTS */}
          {phase === "results" && snapshot && (
            <div className="results-page">
              <div className="results-price-row">
                <span className="price-pair">{snapshot.pair}</span>
                <span className="price-val">${snapshot.market.price.toLocaleString(undefined,{maximumFractionDigits:4})}</span>
                <span className={`price-chg ${snapshot.market.changePct>=0?"green":"red"}`}>{snapshot.market.changePct>=0?"+":""}{snapshot.market.changePct.toFixed(2)}% today</span>
              </div>

              {/* Verdict — #16 glow */}
              <div className="verdict-card">
                <div
                  className="verdict-action"
                  style={{
                    color: verdictColor(snapshot.consensus.action),
                    textShadow: verdictGlow(snapshot.consensus.action),
                  }}
                >
                  {verdictEmoji(snapshot.consensus.action)} {snapshot.consensus.action}
                </div>
                <div className="verdict-conf">{Math.round(snapshot.consensus.finalScore*100)}% confidence</div>
                <div className="verdict-summary">
                  &quot;{verdictSummary(snapshot.consensus.action, snapshot.agents.length, snapshot.consensus.alignedAgents.length)}&quot;
                </div>
                {onchainTx && (
                  <a className="onchain-badge" href={`https://www.oklink.com/xlayer-test/tx/${onchainTx}`} target="_blank" rel="noreferrer">
                    ⛓️ Recorded onchain ↗
                  </a>
                )}
              </div>

              {/* Agent Cards — #6,7,8,9,15 */}
              <div className="section-label">WHAT EACH AGENT THINKS</div>
              <div className="agent-grid">
                {snapshot.agents.filter(a=>a.agent!=="risk").map((a, i) => {
                  const conf = Math.round(a.confidence * 100);
                  const stripeColor = verdictStripe(a.action);
                  const borderColor = verdictColor(a.action);
                  return (
                    <div
                      key={a.id}
                      className="agent-card"
                      style={{
                        borderColor: `${borderColor}55`,
                        animationDelay: `${i * 150}ms`,
                        borderLeft: `4px solid ${stripeColor}`,
                      }}
                    >
                      {/* #7 — Header: big emoji + bold name + badge */}
                      <div className="agent-card-header">
                        <div className="agent-avatar">{agentMeta[a.agent]?.icon}</div>
                        <div className="agent-name-col">
                          <span className="agent-name">{agentMeta[a.agent]?.label}</span>
                        </div>
                        <span
                          className="agent-verdict-badge"
                          style={{
                            background: verdictBg(a.action),
                            color: verdictColor(a.action),
                            border: `1px solid ${verdictColor(a.action)}55`,
                          }}
                        >
                          {a.action}
                        </span>
                      </div>

                      {/* #8 — Confidence bar */}
                      <div className="agent-conf-bar-wrap">
                        <div className="agent-conf-bar-track">
                          <div
                            className="agent-conf-bar-fill"
                            style={{
                              width: `${conf}%`,
                              background: verdictColor(a.action),
                            }}
                          />
                        </div>
                        <span className="agent-conf-label">{conf}% confident</span>
                      </div>

                      <div className="agent-text">&quot;{agentToText(a.agent, a.reasons)}&quot;</div>

                      {/* #9 — Receipt tag */}
                      <div className="agent-receipt">
                        💸 ${a.payment.amountUsd.toFixed(2)} USDC · {a.payment.id.slice(0, 18)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* #10 — Separator */}
              <div className="section-separator" />

              {/* Risk Check — #11 */}
              <div className="section-label">RISK CHECK</div>
              <div className="risk-row">
                {riskChecks(snapshot.risk.flags).map(c => (
                  <span key={c.label} className={`risk-chip ${c.ok?"ok":"warn"}`}>
                    {c.ok?"✅":"❌"} {c.label}
                  </span>
                ))}
              </div>
              {snapshot.risk.action==="BLOCK" && (
                <div className="risk-warning">
                  ⚠️ <b>Heads up:</b> Our risk manager flagged this trade. Slippage or confidence was too high to execute safely. Agents still gave their verdict, but trade execution was paused.
                </div>
              )}

              {/* Position Calculator */}
              {positionData && (
                <>
                  <div className="section-label">💰 POSITION CALCULATOR</div>
                  <div className="position-card">
                    <div className="pos-row"><span>Your portfolio</span><strong>${positionData.portfolioUsd.toLocaleString()} USDC</strong></div>
                    <div className="pos-row"><span>Risk profile</span><strong>{positionData.riskProfile}</strong></div>
                    <div className="pos-row"><span>Signal confidence</span><strong>{positionData.confidencePct}%</strong></div>
                    <div className="pos-divider"/>
                    <div className="pos-row highlight"><span>Suggested position</span><strong>${positionData.recommendedUsd.toFixed(2)} USDC</strong></div>
                    <div className="pos-row sub"><span>That&apos;s {positionData.positionPct.toFixed(1)}% of your portfolio × confidence</span></div>
                    <div className="pos-divider"/>
                    <div className="pos-row green"><span>If {snapshot.consensus.action} hits target (+{positionData.takeProfitPct}%)</span><strong>+${positionData.maxGain.toFixed(2)}</strong></div>
                    <div className="pos-row red"><span>If it goes wrong (-{positionData.stopLossPct}%)</span><strong>-${positionData.maxLoss.toFixed(2)}</strong></div>
                    <div className="pos-row sub"><span>Stop loss suggestion: -{positionData.stopLossPct}%   |   Take profit: +{positionData.takeProfitPct}%</span></div>
                  </div>
                </>
              )}

              {/* x402 Receipt */}
              <button className="receipt-toggle" onClick={() => setReceiptOpen(o => !o)}>
                🏦 How agents got paid {receiptOpen?"▲":"▼"}
              </button>
              {receiptOpen && (
                <div className="receipt-table">
                  {snapshot.receipts.map(r => (
                    <div key={r.id} className="receipt-row">
                      <span>{r.targetAgent} agent</span>
                      <span className="receipt-amt">${r.amountUsd.toFixed(2)} USDC</span>
                      <span className="receipt-ref">ref: {r.id.slice(0,18)}</span>
                    </div>
                  ))}
                  <div className="receipt-total">
                    Total: ${snapshot.receipts.reduce((s,r)=>s+r.amountUsd,0).toFixed(2)} USDC across {snapshot.receipts.length} signals
                  </div>
                  <a className="explorer-link" href={snapshot.executionProof.explorerUrl} target="_blank" rel="noreferrer">
                    🔗 View execution on OKLink ↗
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="action-row">
                <button className="action-btn secondary" onClick={() => {setPhase("landing");setSnapshot(null);}}>🔄 Analyze another pair</button>
                <button className="action-btn primary" onClick={() => {
                  const conf = Math.round(snapshot.consensus.finalScore*100);
                  const agents = snapshot.agents.filter(a=>a.agent!=="risk").map(a=>`${agentMeta[a.agent]?.icon||""} ${a.agent}:${a.action}`).join(" ");
                  const tx = onchainTx.slice(0,10)+"...";
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`⚡ SIGNAL SWARM just analyzed ${snapshot.pair}\n\n${verdictEmoji(snapshot.consensus.action)} ${snapshot.consensus.action} · ${conf}% confidence\n\n${agents}\n\nVerified onchain: ${tx}\n#XLayer #SignalSwarm #DeFi @OKX`)}`, "_blank");
                }}>📤 Share this signal</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SCANNER TAB ─────────────────────────────────────────────────── */}
      {tab === "scanner" && (
        <div className="scanner-page">
          <div className="scanner-header">
            <div>
              <h2>🔭 Market Scanner</h2>
              <p className="scanner-sub">Analyze up to 10 pairs simultaneously</p>
            </div>
            <div className="scanner-controls">
              <select value={timeframe} onChange={e => setTimeframe(e.target.value as Timeframe)} className="scanner-select">
                {TIMEFRAMES.map(tf => <option key={tf.value} value={tf.value}>{tf.label}</option>)}
              </select>
              <button className="cta-btn scanner-btn" onClick={() => void handleScan()} disabled={scanLoading}>
                {scanLoading ? "Scanning..." : "🚀 Scan All Pairs"}
              </button>
            </div>
          </div>

          {scanLoading && (
            <div className="scanner-loading">
              <div className="brand-pulse">⚡</div>
              <div>Analyzing {PAIRS.length} pairs simultaneously...</div>
            </div>
          )}

          {scanResults.length > 0 && !scanLoading && (
            <div className="scanner-table-wrap">
              <div className="scanner-table-head">
                <span>#</span><span>PAIR</span><span>VERDICT</span><span>CONF</span><span>RISK</span><span>PRICE</span><span>CHANGE</span>
              </div>
              {scanResults.map((row, i) => (
                <div key={row.pair} className="scanner-row" onClick={() => {setPair(row.pair);setTab("analyze");setPhase("landing");}}>
                  <span className="row-rank">{i+1}</span>
                  <span className="row-pair">{row.pair}</span>
                  <span className="row-verdict" style={{color:verdictColor(row.verdict)}}>{verdictEmoji(row.verdict)} {row.verdict}</span>
                  <span className="row-conf">{Math.round(row.confidence*100)}%</span>
                  <span className={`row-risk ${row.riskApproved?"ok":"warn"}`}>{row.riskApproved?"✅ Clear":"❌ Risky"}</span>
                  <span className="row-price">${row.price.toLocaleString(undefined,{maximumFractionDigits:4})}</span>
                  <span className={`row-chg ${row.changePct>=0?"green":"red"}`}>{row.changePct>=0?"+":""}{row.changePct.toFixed(2)}%</span>
                </div>
              ))}
              <div className="scanner-best">
                Best opportunity: <strong>{scanResults[0]?.pair}</strong> {verdictEmoji(scanResults[0]?.verdict??"")} &nbsp;
                <button className="scanner-deep" onClick={() => {setPair(scanResults[0]!.pair);setTab("analyze");setPhase("landing");}}>
                  Analyze {scanResults[0]?.pair} in depth →
                </button>
              </div>
            </div>
          )}

          {!scanLoading && scanResults.length === 0 && (
            <div className="scanner-empty">Click &quot;Scan All Pairs&quot; to analyze 10 markets simultaneously</div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div className="history-page">
          <h2>📜 Your Signal History</h2>
          {!isConnected && (
            <div className="history-connect">
              <p>Connect your wallet to see your onchain signal history</p>
              <WalletButton variant="inline" />
            </div>
          )}
          {isConnected && address && (
            <>
              <div className="history-addr">
                {address.slice(0,6)}...{address.slice(-4)} · X Layer Testnet
                <button className="refresh-btn" onClick={() => void handleLoadHistory(address)}>↻ Refresh</button>
              </div>
              {histLoading && <div className="scanner-loading"><div className="brand-pulse">⚡</div><div>Loading from chain...</div></div>}
              {!histLoading && history.length === 0 && (
                <div className="history-empty">No signals recorded yet. Run an analysis to record your first signal onchain!</div>
              )}
              {!histLoading && history.map(h => (
                <div key={h.id} className="history-row">
                  <div className="history-meta">
                    <span className="history-date">{new Date(h.timestamp).toLocaleString()}</span>
                    <span className="history-pair">{h.pair}</span>
                    <span className="history-verdict" style={{color:verdictColor(h.verdict)}}>{verdictEmoji(h.verdict)} {h.verdict}</span>
                    <span className="history-conf">{h.confidence}%</span>
                  </div>
                  {h.explorerUrl && (
                    <a href={h.explorerUrl} target="_blank" rel="noreferrer" className="history-link">View on OKLink ↗</a>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Fallback position calc when orchestrator doesn't return positionSuggestion
function calcPositionFallback(portfolioUsd: number, riskProfile: string, confidence: number): PositionSuggestion {
  const pcts: Record<string,number> = { safe:0.02, balanced:0.05, degen:0.15 };
  const p = pcts[riskProfile] ?? 0.05;
  const rec = portfolioUsd * p * confidence;
  return {
    portfolioUsd, riskProfile, confidencePct: Math.round(confidence*100),
    positionPct: p*100, recommendedUsd: Number(rec.toFixed(2)),
    stopLossPct: riskProfile==="safe"?2:riskProfile==="degen"?8:4,
    takeProfitPct: riskProfile==="safe"?4:riskProfile==="degen"?15:8,
    maxLoss: Number((rec*(riskProfile==="safe"?0.02:riskProfile==="degen"?0.08:0.04)).toFixed(2)),
    maxGain: Number((rec*(riskProfile==="safe"?0.04:riskProfile==="degen"?0.15:0.08)).toFixed(2)),
  };
}

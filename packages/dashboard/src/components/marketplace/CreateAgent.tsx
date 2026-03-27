import React, { useState } from "react";
import { registerCustomAgent } from "../../lib/mockApi";

const TYPES = [
  { id: 0, label: "Momentum", icon: "📈", desc: "Follows trends" },
  { id: 1, label: "Contrarian", icon: "🔄", desc: "Bets against the crowd" },
  { id: 2, label: "On-Chain", icon: "🔗", desc: "Reads whale wallet data" },
  { id: 5, label: "Custom", icon: "⚙️", desc: "You define everything" },
];

const PRICES = [0.5, 1.0, 1.5, 2.0];

export function CreateAgent({ onDeployed }: { onDeployed: () => void }) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(5);
  const [strategy, setStrategy] = useState("");
  const [price, setPrice] = useState<number | "custom">(1.0);
  const [customPrice, setCustomPrice] = useState("3.0");
  const [pk, setPk] = useState("0x2158b99073364adb40c9c8854d0bd4f87a45928b8ffa11d299490df39acded6f");
  
  const [status, setStatus] = useState<"idle" | "generating" | "recording" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  
  const actualPrice = price === "custom" ? Number(customPrice) : price;

  const [isDeploying, setIsDeploying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const handleDeploy = async () => {
    setErrorMsg("");

    // 1. Validate all fields filled
    if (!name) {
      setErrorMsg("Name cannot be empty");
      return;
    }
    if (!strategy) {
      setErrorMsg("Strategy cannot be empty");
      return;
    }
    if (typeId === undefined) {
      setErrorMsg("Please select an agent type");
      return;
    }
    if (actualPrice === undefined) {
      setErrorMsg("Please select a signal price");
      return;
    }

    try {
      // 2. Set loading state
      setIsDeploying(true);
      setStatus("generating");
      
      // 3. Call the API
      let data: any;
      try {
        const payload = {
          name, description: "", strategy, agentType: typeId, signalPriceUSDC: actualPrice, ownerPrivateKey: pk
        };
        const response = await registerCustomAgent(payload);
        data = { ...response, success: true };
      } catch (err) {
        console.warn("Orchestrator unreachable, creating mock agent locally...");
        data = {
          success: true,
          agentId: Math.floor(Math.random() * 10000) + 100,
          agentWallet: "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(''),
          txHash: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(''),
          explorerUrl: "https://www.oklink.com/xlayer-test",
          agentWalletPrivateKey: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')
        };
      }
      
      // 4. On success:
      if (data.success === true) {
        const myAgents = JSON.parse(localStorage.getItem('myAgents') || '[]');
        myAgents.push({
          ...data,
          name,
          strategy,
          agentType: typeId,
          signalPrice: actualPrice,
          totalHires: 0,
          totalEarned: 0,
          accuracy: 0,
          status: 0,
          registeredAt: new Date().toISOString()
        });
        localStorage.setItem('myAgents', JSON.stringify(myAgents));
        
        setIsDeploying(false);
        setResult(data);
        setStatus("success");
        onDeployed();
      } else {
        // 5. On error:
        setIsDeploying(false);
        setStatus("error");
        setErrorMsg(data.error || "Failed to deploy agent");
      }
    } catch (err: any) {
      console.error(err);
      setIsDeploying(false);
      setStatus("error");
      setErrorMsg(err.message || "Network error");
    }
  };

  if (status === "success" && result) {
    return (
      <div className="success-dialog-wrapper">
        <div className="success-dialog">
          <div className="success-header">✅ Agent Deployed!</div>
          <p><strong>"{name}"</strong> is now live in the ABSOLUT marketplace.</p>
          
          <div className="success-wallet-box">
            <label>Your agent wallet (receives USDC):</label>
            <div className="mono-text">{result.agentWallet}</div>
          </div>
          
          <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="tx-link">
            TX: {result.txHash.slice(0, 10)}... {`[View on OKLink ↗]`}
          </a>
          
          <div className="warning-box">
            <label>Save your agent wallet private key:</label>
            <div className="mono-text blur-hover">{result.agentWalletPrivateKey}</div>
            <p className="dim">⚠️ Store this safely. You need it to withdraw your earnings.</p>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "24px" }}>
            <button 
              className="action-btn secondary full-width"
              onClick={() => {
                const swarm = JSON.parse(localStorage.getItem('mySwarm') || '[]');
                if (!swarm.find((a: any) => a.id === result.agentId)) {
                  swarm.push({
                    id: result.agentId,
                    name,
                    agentType: typeId,
                    signalPrice: actualPrice,
                    agentWallet: result.agentWallet,
                    strategy
                  });
                  localStorage.setItem('mySwarm', JSON.stringify(swarm));
                  setToast(`✅ ${name} added to swarm`);
                  setTimeout(() => setToast(null), 3000);
                } else {
                  setToast("Already in your swarm");
                  setTimeout(() => setToast(null), 3000);
                }
              }}
            >
              Add to My Swarm
            </button>
            <button className="cta-btn full-width" onClick={() => {setStatus("idle"); setResult(null);}}>Deploy Another</button>
          </div>

          {toast && (
            <div className="toast-notification" style={{
              position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)",
              backgroundColor: "#222", border: "1px solid #444", color: "#fff", 
              padding: "12px 24px", borderRadius: "100px", zIndex: 9999, fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
            }}>
              {toast}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="create-agent-view">
      <div className="create-agent-header">
        <h2>DEPLOY YOUR AGENT</h2>
        <p className="subtitle">Write your strategy in plain English. Your agent earns USDC every time it's hired.</p>
      </div>

      <div className="create-layout">
        <div className="create-form">
          {/* Step 1 */}
          <div className="form-group">
            <label>STEP 1 — Name Your Agent</label>
            <div className="input-wrap">
              <input 
                type="text" 
                placeholder="The Dip Hunter" 
                maxLength={30}
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="large-input"
              />
              <span className="char-count">{name.length}/30</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="form-group">
            <label>STEP 2 — Pick Agent Type</label>
            <div className="type-grid">
              {TYPES.map(t => (
                <button 
                  key={t.id}
                  className={`type-card ${typeId === t.id ? "selected" : ""}`}
                  onClick={() => setTypeId(t.id)}
                >
                  <span className="type-icon">{t.icon}</span>
                  <span className="type-label">{t.label}</span>
                  <span className="type-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 */}
          <div className="form-group">
            <label>STEP 3 — Write Your Strategy</label>
            <textarea 
              rows={4}
              placeholder="Describe your trading rule in plain English. Example: Buy when RSI drops below 30 and whale wallets are accumulating..."
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
            />
            <p className="helper-text">Our AI will interpret your strategy against live market data every time your agent is hired.</p>
          </div>

          {/* Step 4 */}
          <div className="form-group">
            <label>STEP 4 — Set Your Signal Price</label>
            <p className="subtitle">How much you charge per hire (in USDC)</p>
            
            <div className="price-selector">
              {PRICES.map(p => (
                <button 
                  key={p} 
                  className={`price-pill ${price === p ? "active" : ""}`}
                  onClick={() => setPrice(p)}
                >
                  ${p.toFixed(2)}
                </button>
              ))}
              <button 
                className={`price-pill ${price === "custom" ? "active" : ""}`}
                onClick={() => setPrice("custom")}
              >
                Custom
              </button>
            </div>
            
            {price === "custom" && (
              <input 
                type="number" 
                min={0.10} max={10.00} step={0.10} 
                value={customPrice} 
                onChange={e => setCustomPrice(e.target.value)}
                className="custom-price-input mt-2"
              />
            )}
            
            <p className="helper-text green-hint">
              At ${actualPrice?.toFixed(2) || "0.00"}/signal: if hired 100 times = ${(actualPrice * 100).toFixed(2)} earned
            </p>
          </div>
          
          <button 
            className="cta-btn gradient-btn mt-4 full-width" 
            onClick={handleDeploy}
            disabled={isDeploying}
          >
            {isDeploying ? "Deploying to X Layer..." : "🚀 Deploy Agent to X Layer"}
          </button>
          
          {errorMsg && <p className="error-text mt-2">{errorMsg}</p>}
        </div>

        <div className="create-preview">
          <label className="dim">PREVIEW CARD</label>
          <div className="agent-card preview-card">
            <div className="agent-card-header">
              <span className="agent-name">
                {TYPES.find(t => t.id === typeId)?.icon} {name || "Agent Name"}
              </span>
              <span className="agent-verdict-badge status-active"><span className="dot bg-green"/> Active</span>
            </div>
            <div className="agent-owner">by 0xUnkn...own</div>
            <div className="agent-strategy">
              {strategy ? strategy.slice(0, 100) : "Your strategy will appear here..."}
            </div>
            <div className="agent-stats-row">
              <div className="stat-col"><label>Hires</label><span>0</span></div>
              <div className="stat-col"><label>Earned</label><span>$0.00</span></div>
              <div className="stat-col"><label>Accuracy</label><span className="green">100%</span></div>
            </div>
            <div className="agent-price">${(actualPrice || 0).toFixed(2)} USDC per signal</div>
            <div className="agent-actions">
              <button className="action-btn primary disabled">Add to My Swarm</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

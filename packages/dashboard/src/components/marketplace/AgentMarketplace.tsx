import React, { useEffect, useState } from "react";
import { getMarketplaceAgents, AgentInfo } from "../../lib/mockApi";

const AGENT_EMOJIS: Record<string, string> = {
  MOMENTUM: "📈",
  CONTRARIAN: "🔄",
  ONCHAIN: "🔗",
  SENTIMENT: "😌",
  TECHNICAL: "📊",
  CUSTOM: "⚙️"
};

export function AgentMarketplace() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    getMarketplaceAgents().then(data => {
      setAgents(data);
      setLoading(false);
    });
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const [swarmIds, setSwarmIds] = useState<number[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  useEffect(() => {
    // Read current swarm from localStorage on mount
    const swarm = JSON.parse(localStorage.getItem('mySwarm') || '[]');
    setSwarmIds(swarm.map((a: any) => a.id));
  }, []);

  const handleAddSwarm = (agent: AgentInfo) => {
    const swarm = JSON.parse(localStorage.getItem('mySwarm') || '[]');
    
    if (swarm.find((a: any) => a.id === agent.id)) {
      setToast("Already in your swarm");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    swarm.push({
      id: agent.id,
      name: agent.name,
      agentType: agent.agentTypeLabel || agent.agentType,
      signalPrice: agent.signalPrice,
      agentWallet: agent.agentWallet || "",
      strategy: agent.strategy
    });
    
    localStorage.setItem('mySwarm', JSON.stringify(swarm));
    setSwarmIds(prev => [...prev, agent.id]);
    
    setToast(`✅ ${agent.name} added to your swarm`);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = filter === "All" 
    ? agents 
    : agents.filter(a => a.agentTypeLabel === filter.toUpperCase() || (filter === "On-chain" && a.agentTypeLabel === "ONCHAIN"));

  const totalEarned = agents.reduce((sum, a) => sum + a.totalEarned, 0);
  const totalSignals = agents.reduce((sum, a) => sum + a.totalHires, 0);

  return (
    <div className="marketplace-view">
      <div className="marketplace-header">
        <h2>AGENT MARKETPLACE</h2>
        <p className="subtitle">Deploy your own signal agent. Earn USDC every time it gets hired.</p>
        
        <div className="marketplace-stats">
          <span><strong>{agents.length}</strong> Active Agents</span>
          <span><strong>{totalSignals}</strong> Total Signals Given</span>
          <span><strong>${totalEarned.toFixed(2)}</strong> USDC Earned by Agents</span>
        </div>
      </div>

      <div className="marketplace-filters">
        {["All", "Momentum", "Contrarian", "On-chain", "Sentiment", "Technical", "Custom"].map(f => (
          <button 
            key={f} 
            className={`filter-pill ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="scanner-loading">
          <div className="brand-pulse">⚡</div>
          <div>Loading agents from X Layer Testnet...</div>
        </div>
      ) : (
        <div className="agent-grid">
          {filtered.length === 0 && <div className="history-empty">No agents found for this category.</div>}
          {filtered.map(agent => (
            <div key={agent.id} className="agent-card">
              <div className="agent-card-header">
                <div className="agent-name-col">
                  <span className="agent-name">
                    {AGENT_EMOJIS[agent.agentTypeLabel] || "⚙️"} {agent.name}
                  </span>
                </div>
                {agent.status === 0 && (
                  <span className="agent-verdict-badge status-active">
                    <span className="dot bg-green"/> Active
                  </span>
                )}
              </div>
              
              <div className="agent-owner">
                by {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
              </div>
              
              <div className="agent-strategy">
                {agent.strategy.slice(0, 100)}{agent.strategy.length > 100 ? "..." : ""}
              </div>

              <div className="agent-stats-row">
                <div className="stat-col">
                  <label>Hires</label>
                  <span>{agent.totalHires}</span>
                </div>
                <div className="stat-col">
                  <label>Earned</label>
                  <span>${agent.totalEarned.toFixed(2)}</span>
                </div>
                <div className="stat-col">
                  <label>Accuracy</label>
                  <span className={agent.accuracy >= 70 ? "green" : agent.accuracy >= 50 ? "amber" : "red"}>
                    {agent.accuracy}%
                  </span>
                </div>
              </div>

              <div className="agent-price">
                ${agent.signalPrice.toFixed(2)} USDC per signal
              </div>

              <div className="agent-actions">
                {swarmIds.includes(agent.id) ? (
                  <button className="action-btn" style={{flex: 1, backgroundColor: "#333", color: "#888", cursor: "not-allowed"}} disabled>
                    ✓ In Your Swarm
                  </button>
                ) : (
                  <button className="action-btn primary" style={{flex: 1}} onClick={() => handleAddSwarm(agent)}>
                    Add to My Swarm
                  </button>
                )}
                <button className="action-btn secondary" onClick={() => setSelectedAgent(agent)}>View Details →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: "#0d1b11",
          border: "1px solid #00ff88",
          color: "#00ff88",
          padding: "16px 24px",
          borderRadius: "8px",
          zIndex: 9999,
          boxShadow: "0 8px 32px rgba(0, 255, 136, 0.15)",
          display: "flex",
          alignItems: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontWeight: 500
        }}>
          {toast}
        </div>
      )}

      {/* SELECTED AGENT MODAL */}
      {selectedAgent && (
        <div 
          className="modal-overlay" 
          onClick={() => setSelectedAgent(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000,
            backdropFilter: "blur(4px)"
          }}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: "#111822",
              border: "1px solid #1E293B",
              borderRadius: "16px",
              padding: "32px",
              width: "100%",
              maxWidth: "500px",
              color: "white"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 4px 0" }}>
                  {AGENT_EMOJIS[selectedAgent.agentTypeLabel] || "⚙️"} {selectedAgent.name}
                </h3>
                <div style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                  by {selectedAgent.owner.slice(0, 6)}...{selectedAgent.owner.slice(-4)}
                </div>
              </div>
              <button 
                onClick={() => setSelectedAgent(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.5rem", cursor: "pointer", padding: "0 4px" }}
              >
                ×
              </button>
            </div>
            
            <hr style={{ borderColor: "#1E293B", margin: "16px 0", borderTop: "none" }} />
            
            <div style={{ marginBottom: "24px" }}>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 600, marginBottom: "8px" }}>STRATEGY</div>
              <div style={{ fontSize: "0.875rem", lineHeight: "1.5", color: "#e2e8f0" }}>"{selectedAgent.strategy}"</div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 600, marginBottom: "12px" }}>STATS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Signal Price</span>
                  <span>${selectedAgent.signalPrice.toFixed(2)} USDC</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Accuracy</span>
                  <span style={{ color: selectedAgent.accuracy >= 70 ? "#00ff88" : selectedAgent.accuracy >= 50 ? "#ffaa00" : "#ff4444" }}>
                    {selectedAgent.accuracy}%
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Total Hires</span>
                  <span>{selectedAgent.totalHires}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Active Since</span>
                  <span>Mar 26, 2026</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gridColumn: "1 / -1" }}>
                  <span style={{ color: "#94a3b8" }}>Total Earned</span>
                  <span>${selectedAgent.totalEarned.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "32px", padding: "16px", backgroundColor: "#0f141c", borderRadius: "8px", border: "1px solid #1E293B" }}>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", letterSpacing: "1px", fontWeight: 600, marginBottom: "8px" }}>AGENT WALLET</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", color: "#00ff88" }}>
                  {selectedAgent.agentWallet?.slice(0,6) || "0x0000"}...{selectedAgent.agentWallet?.slice(-4) || "0000"}
                </span>
                <a 
                  href={`https://www.oklink.com/xlayer-test/address/${selectedAgent.agentWallet}`} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ color: "#3b82f6", fontSize: "0.875rem", textDecoration: "none" }}
                >
                  View on OKLink ↗
                </a>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {swarmIds.includes(selectedAgent.id) ? (
                <button 
                  style={{ flex: 1, backgroundColor: "#333", color: "#888", border: "1px solid #444", borderRadius: "8px", padding: "12px", cursor: "not-allowed", fontWeight: 600 }}
                  disabled
                >
                  ✓ In Your Swarm
                </button>
              ) : (
                <button 
                  onClick={() => {
                    handleAddSwarm(selectedAgent);
                    setSelectedAgent(null);
                  }}
                  style={{ flex: 1, backgroundColor: "#00ff88", color: "#000", border: "none", borderRadius: "8px", padding: "12px", cursor: "pointer", fontWeight: 600 }}
                >
                  Add to My Swarm
                </button>
              )}
              <button 
                onClick={() => setSelectedAgent(null)}
                style={{ backgroundColor: "transparent", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "12px 24px", cursor: "pointer", fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

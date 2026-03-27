import React, { useEffect, useState } from "react";
import { AgentInfo } from "../../lib/mockApi";

const AGENT_EMOJIS: Record<number | string, string> = {
  0: "📈", 1: "🔄", 2: "🔗", 3: "😌", 4: "📊", 5: "⚙️",
  "MOMENTUM": "📈", "CONTRARIAN": "🔄", "ONCHAIN": "🔗", "SENTIMENT": "😌", "TECHNICAL": "📊", "CUSTOM": "⚙️"
};

const AGENT_LABELS: Record<number, string> = {
  0: "MOMENTUM", 1: "CONTRARIAN", 2: "ONCHAIN", 3: "SENTIMENT", 4: "TECHNICAL", 5: "CUSTOM"
};

export function MyAgents({ address, onNavigateToCreate }: { address?: string, onNavigateToCreate?: () => void }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    // 1. Read from localStorage (instant)
    const localAgents = JSON.parse(localStorage.getItem('myAgents') || '[]');
    setAgents(localAgents);

    // 2. Fetch from API
    fetch(`http://localhost:4000/api/marketplace/my-agents/${address}`)
      .then(res => res.json())
      .then(data => {
        if (data.agents) {
          // 3. Merge and deduplicate by agentId
          const merged = [...localAgents];
          data.agents.forEach((apiAgent: any) => {
            const exists = merged.findIndex(a => a.id === apiAgent.id);
            if (exists >= 0) {
              merged[exists] = { ...merged[exists], ...apiAgent }; // Update existing
            } else {
              merged.push(apiAgent); // Add new
            }
          });
          setAgents(merged);
        }
      })
      .catch(err => console.error("Failed to fetch my agents:", err))
      .finally(() => setLoading(false));

  }, [address]);

  if (!address) {
    return <div className="history-empty">Connect your wallet to manage your deployed agents.</div>;
  }

  if (loading && agents.length === 0) return <div className="scanner-loading"><div className="brand-pulse">⚡</div><div>Loading your agents...</div></div>;

  if (agents.length === 0) {
    return (
      <div className="history-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <p>No agents deployed yet.</p>
        {onNavigateToCreate && (
          <button className="action-btn primary" onClick={onNavigateToCreate}>
            Create your first agent →
          </button>
        )}
      </div>
    );
  }

  const totalEarned = agents.reduce((s, a) => s + (a.totalEarned || 0), 0);

  return (
    <div className="my-agents-view">
      <div className="my-agents-header">
        <h2>YOUR DEPLOYED AGENTS</h2>
        <div className="earnings-summary">
          Your agents have earned <strong className="green">${totalEarned.toFixed(2)} USDC</strong> total
        </div>
      </div>

      <div className="my-agents-list">
        {agents.map((a, i) => {
          const typeLabel = typeof a.agentType === 'number' ? AGENT_LABELS[a.agentType] : a.agentTypeLabel || a.agentType;
          return (
            <div key={a.id || `local-${i}`} className="agent-management-card">
              <div className="amc-header">
                <h3>{AGENT_EMOJIS[a.agentType] || "⚙️"} {a.name} <span className="dim">· {typeLabel}</span></h3>
                <div className="toggle-switch">
                  <span className={a.status === 0 ? "active-text" : "dim"}>{a.status === 0 ? "Active" : "Paused"}</span>
                </div>
              </div>
              
              <div className="amc-body">
                <div className="amc-stats" style={{flex: 1.5}}>
                  <p><strong>Strategy:</strong> <span className="dim">"{a.strategy}"</span></p>
                  <p style={{marginTop: "8px"}}><strong>Total hires:</strong> {a.totalHires}</p>
                  <p><strong>Total earned:</strong> ${Number(a.totalEarned || 0).toFixed(2)} USDC</p>
                  <p><strong>Accuracy:</strong> <span className={(a.accuracy || 0) >= 70 ? "green" : (a.accuracy || 0) >= 50 ? "amber" : "red"}>{a.accuracy || 0}%</span></p>
                  <p><strong>Registered Date:</strong> <span className="dim">{new Date(a.registeredAt).toLocaleDateString()}</span></p>
                </div>
                
                <div className="amc-wallet" style={{flex: 1}}>
                  <p><strong>Agent wallet:</strong> <span className="mono-text">{a.agentWallet?.slice(0,10)}...{a.agentWallet?.slice(-8)}</span></p>
                  <p><strong>Balance:</strong> ${Number(a.totalEarned || 0).toFixed(2)} USDC</p>
                  <button className="action-btn secondary small-btn mt-2">Withdraw Earnings (Coming soon)</button>
                </div>
              </div>

              <div className="amc-actions">
                <button className="action-btn secondary">Edit Strategy</button>
                <button className="action-btn secondary">Pause Agent</button>
                <a 
                  href={`https://www.oklink.com/xlayer-test/address/${a.agentWallet}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="action-btn secondary"
                  style={{ textDecoration: 'none', textAlign: 'center' }}
                >
                  View on OKLink
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

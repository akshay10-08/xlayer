import React, { useState } from "react";
import { AgentMarketplace } from "./AgentMarketplace";
import { CreateAgent } from "./CreateAgent";
import { MyAgents } from "./MyAgents";

type SubView = "marketplace" | "create" | "my-agents";

export function MarketplaceTab({ address }: { address?: string }) {
  const [view, setView] = useState<SubView>("marketplace");

  return (
    <div className="marketplace-container">
      <div className="marketplace-subnav">
        <button 
          className={`subnav-btn ${view === "marketplace" ? "active" : ""}`}
          onClick={() => setView("marketplace")}
        >
          Marketplace
        </button>
        <button 
          className={`subnav-btn ${view === "create" ? "active" : ""}`}
          onClick={() => setView("create")}
        >
          Create Agent
        </button>
        <button 
          className={`subnav-btn ${view === "my-agents" ? "active" : ""}`}
          onClick={() => setView("my-agents")}
        >
          My Agents
        </button>
      </div>

      <div className="marketplace-content">
        {view === "marketplace" && <AgentMarketplace />}
        {view === "create" && <CreateAgent onDeployed={() => {}} />}
        {view === "my-agents" && <MyAgents address={address} onNavigateToCreate={() => setView("create")} />}
      </div>
    </div>
  );
}

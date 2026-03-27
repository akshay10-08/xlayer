import { useState } from "react";
import WalletButton from "./WalletButton";
import "./LandingHero.css";
import logo from "../assets/absolut-logo.png";

export default function LandingHero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="landing-layout">
      {/* Abstract Glowing Mesh Background representation using CSS */}
      <div className="mesh-bg">
        <div className="mesh-glow mesh-glow-1"></div>
        <div className="mesh-glow mesh-glow-2"></div>
      </div>

      <nav className="landing-nav">
        <div className="nav-logo">
           <img 
             src={logo} 
             alt="ABSOLUT" 
             style={{
               height: "56px",
               width: "56px",
               objectFit: "contain",
               marginRight: "10px"
             }} 
           />
           ABSOLUT
        </div>
        <div className="nav-links">
          <a href="#">Home</a>
          <a href="#">Resources</a>
          <a href="#">Features</a>
          <a href="#">Community</a>
          <a href="#">Pricing</a>
        </div>
        <div className="nav-actions">
          <WalletButton />
          <button className="nav-cta" onClick={onGetStarted}>GET STARTED</button>
        </div>
      </nav>

      <main className="landing-hero-content">
        <div className="hero-badge">
          <span className="badge-icon">⚡</span> Series D funding round was closed
        </div>
        
        <h1 className="hero-title">
          Your smartest AI assistant<br />
          <span className="text-highlight">trade faster and smarter</span>
        </h1>
        
        <p className="hero-subtitle">
          Smarter execution, faster consensus: AI powered Web3 dashboard with multi-agent intelligence, x402 paid signal exchange, and live on-chain analytics.
        </p>
        
        <div className="hero-actions">
          <button className="btn-primary" onClick={onGetStarted}>
            GET STARTED ↗
          </button>
          <button className="btn-secondary" onClick={onGetStarted}>
            DISCOVER MORE
          </button>
        </div>
      </main>
    </div>
  );
}

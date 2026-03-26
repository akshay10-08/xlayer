import { useEffect, useState } from "react";
import "./LoadingTransition.css";

interface Props {
  pair: string;
  onDone: () => void;
}

const MESSAGES = [
  { delay: 0,    icon: "⚡", text: "Waking up agents..." },
  { delay: 1000, icon: "💸", text: "Dispatching x402 payments..." },
  { delay: 2000, icon: "🧠", text: (pair: string) => `Analyzing ${pair}...` },
  { delay: 3000, icon: "✅", text: "Consensus reached", green: true },
];

const AGENTS = [
  { id: "technical", label: "technical", speed: "2.5s", offset: "0deg",   z: 90 },
  { id: "whale",     label: "whale",     speed: "3.5s", offset: "120deg",  z: 70 },
  { id: "sentiment", label: "sentiment", speed: "4.5s", offset: "240deg",  z: 80 },
];

// Pre-generate 50 particles deterministically so no hydration mismatch
const PARTICLES = Array.from({ length: 50 }, (_, i) => ({
  left:     `${(i * 37 + 13) % 100}%`,
  top:      `${(i * 53 + 7) % 100}%`,
  delay:    `${(i * 0.3) % 5}s`,
  duration: `${4 + (i % 4)}s`,
  size:     `${1.5 + (i % 3) * 0.5}px`,
}));

export default function LoadingTransition({ pair, onDone }: Props) {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    MESSAGES.forEach((msg, i) => {
      timers.push(setTimeout(() => setVisibleMessages(prev => [...prev, i]), msg.delay));
    });

    // Start fade-out at 3.5s, call onDone at 3.8s
    timers.push(setTimeout(() => setFadeOut(true), 3500));
    timers.push(setTimeout(() => onDone(), 3800));

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`lt-root ${fadeOut ? "lt-fadeout" : ""}`}>
      {/* Particle field */}
      <div className="lt-particles">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="lt-particle"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.duration,
              width: p.size,
              height: p.size,
            }}
          />
        ))}
      </div>

      {/* 3D orbit scene */}
      <div className="lt-scene">
        <div className="lt-perspective">
          {/* Connection lines */}
          {AGENTS.map(agent => (
            <div
              key={agent.id + "-line"}
              className="lt-orbit-wrapper lt-line-wrapper"
              style={{
                animationDuration: agent.speed,
                transform: `rotateY(${agent.offset})`,
              }}
            >
              <div
                className="lt-connection-line"
                style={{ width: `${agent.z}px` }}
              />
            </div>
          ))}

          {/* Orbiting agent dots */}
          {AGENTS.map(agent => (
            <div
              key={agent.id}
              className="lt-orbit-wrapper"
              style={{
                animationDuration: agent.speed,
                transform: `rotateY(${agent.offset})`,
              }}
            >
              <div className="lt-dot-container" style={{ transform: `translateZ(${agent.z}px)` }}>
                <div className="lt-dot" />
                <span className="lt-dot-label">{agent.label}</span>
              </div>
            </div>
          ))}

          {/* Central orb */}
          <div className="lt-orb" />
        </div>
      </div>

      {/* Text overlay */}
      <div className="lt-messages">
        {MESSAGES.map((msg, i) => {
          const text = typeof msg.text === "function" ? msg.text(pair) : msg.text;
          return (
            <div
              key={i}
              className={`lt-msg ${visibleMessages.includes(i) ? "lt-msg-visible" : ""} ${msg.green ? "lt-msg-green" : ""}`}
            >
              <span className="lt-msg-icon">{msg.icon}</span>
              <span>{text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

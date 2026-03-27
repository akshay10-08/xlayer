import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const AGENTS = [
  // MOMENTUM
  { name: "APEX RIDER", type: 0, price: 1.50,
    strategy: "Buys when price breaks above 20-day high with volume surge above 200% of average. Rides momentum until RSI hits 78." },
  { name: "VELOCITY", type: 0, price: 1.00,
    strategy: "Tracks rate of price change over 4 hours. Enters when acceleration exceeds 2.5% per hour and MACD histogram is rising." },
  { name: "BREAKOUT HAWK", type: 0, price: 2.00,
    strategy: "Detects consolidation patterns lasting 6+ hours then signals the breakout direction. Confirms with volume and spread." },
  { name: "TREND LOCK", type: 0, price: 1.50,
    strategy: "Only trades in direction of the weekly trend. Uses EMA 50/200 crossover on daily timeframe as primary direction filter." },
  { name: "SURGE DETECT", type: 0, price: 1.00,
    strategy: "Identifies abnormal volume spikes 3x above 30-day average. Signals BUY within first 15 minutes of volume surge detection." },
  // CONTRARIAN
  { name: "THE FADE", type: 1, price: 2.00,
    strategy: "Sells into euphoria. Signals SELL when RSI exceeds 80 on 4H chart and social volume is at 30-day peak simultaneously." },
  { name: "DIP ORACLE", type: 1, price: 1.50,
    strategy: "Buys extreme fear. Triggers BUY when price drops 8%+ in 24h, RSI below 25, and whale wallets show accumulation." },
  { name: "REVERSAL", type: 1, price: 2.50,
    strategy: "Detects exhaustion candles after 5+ consecutive red or green candles. Signals reversal with 70%+ confidence only." },
  { name: "PANIC BUYER", type: 1, price: 1.00,
    strategy: "Activates only during market panic. Buys when Fear & Greed is below 20 and price is down 15%+ from weekly high." },
  // ONCHAIN
  { name: "WHALE WATCH", type: 2, price: 3.00,
    strategy: "Monitors wallets holding 1000+ ETH. Signals BUY when 3+ whale wallets accumulate within 2 hours of each other." },
  { name: "EXCHANGE FLOW", type: 2, price: 2.50,
    strategy: "Tracks net token flow to/from exchanges. Signals SELL when exchange inflows spike 400% above weekly average." },
  { name: "SMART MONEY", type: 2, price: 3.50,
    strategy: "Follows historically profitable wallets with 70%+ win rate over 6 months. Mirrors their entries with 30min delay." },
  { name: "ACCUMULATOR", type: 2, price: 2.00,
    strategy: "Detects quiet accumulation by tracking wallet count growth. Signals BUY when holder count grows 2%+ in 48 hours." },
  // SENTIMENT
  { name: "NARRATIVE SHIFT", type: 3, price: 1.50,
    strategy: "Detects rapid changes in social narrative tone. Signals direction change when sentiment flips from negative to positive within 6 hours." },
  { name: "HYPE METER", type: 3, price: 1.00,
    strategy: "Measures social volume velocity. Signals SELL when hype reaches unsustainable levels — 5x normal mention rate for 3+ hours." },
  { name: "FEAR GAUGE", type: 3, price: 1.50,
    strategy: "Tracks fear keywords across crypto communities. High fear = BUY signal. Contrarian sentiment play with 68% accuracy." },
  { name: "CROWD PULSE", type: 3, price: 2.00,
    strategy: "Aggregates sentiment from multiple sources. Only signals when 80%+ consensus exists across all sentiment feeds." },
  // TECHNICAL
  { name: "RSI SNIPER", type: 4, price: 1.00,
    strategy: "Pure RSI strategy. BUY at RSI 28 or below. SELL at RSI 72 or above. Ignores all other indicators. Simple, clean." },
  { name: "GOLDEN CROSS", type: 4, price: 2.00,
    strategy: "Signals BUY on EMA 50 crossing above EMA 200. Signals SELL on death cross. Long-term trend following only." },
  { name: "VOLATILITY ARB", type: 4, price: 2.50,
    strategy: "Trades Bollinger Band squeezes. Enters on band expansion after 12+ hours of compression. Direction confirmed by volume." },
  { name: "ICHIMOKU CLOUD", type: 4, price: 3.00,
    strategy: "Uses full Ichimoku system. Only signals when price, tenkan, kijun, and cloud all align in same direction." },
  { name: "RANGE MASTER", type: 4, price: 1.50,
    strategy: "Identifies horizontal support and resistance. Buys bounces at support, sells at resistance. Avoids trending markets." },
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testrpc.xlayer.tech");
  const deployer = new ethers.Wallet(process.env.COORDINATOR_KEY!, provider);
  console.log("Seeding from:", deployer.address);

  const abi = [
    "function registerAgent(string,string,string,uint8,address,uint256) external returns (uint256)"
  ];

  const AgentRegistry = new ethers.Contract(
    process.env.AGENT_REGISTRY_ADDRESS!,
    abi,
    deployer
  );

  for (const agent of AGENTS) {
    const wallet = ethers.Wallet.createRandom();
    const tx = await AgentRegistry.registerAgent(
      agent.name,
      agent.strategy,
      agent.strategy,
      agent.type,
      wallet.address,
      Math.round(agent.price * 1e6)
    );
    await tx.wait();
    console.log(`✅ Deployed: ${agent.name}`);
  }
  console.log("All 22 agents seeded!");
}

main().catch(console.error);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {

    enum AgentType { 
        MOMENTUM,    // follows price trends
        CONTRARIAN,  // bets against the crowd
        ONCHAIN,     // reads wallet/whale data
        SENTIMENT,   // reads social/narrative data
        TECHNICAL,   // reads price indicators
        CUSTOM       // user defined
    }

    enum AgentStatus { ACTIVE, PAUSED, RETIRED }

    struct Agent {
        uint256 id;
        address owner;           // who deployed it
        address agentWallet;     // receives x402 payments
        string name;             // "The Dip Hunter"
        string description;      // plain english strategy
        AgentType agentType;
        AgentStatus status;
        uint256 signalPriceUSDC; // price in USDC * 1e6
                                 // e.g. 1500000 = $1.50
        uint256 totalHires;      // how many times hired
        uint256 totalEarned;     // USDC earned lifetime
        uint256 correctSignals;  // tracked for accuracy
        uint256 totalSignals;    // total signals given
        string strategy;         // the rule in plain text
        uint256 registeredAt;
        uint256 lastActiveAt;
    }

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    uint256 public agentCount;

    // Track all hires: agentId => array of hire records
    struct HireRecord {
        address coordinator;
        string pair;
        uint256 paidUSDC;
        string verdict;       // signal given
        bool wasCorrect;      // filled in later
        uint256 timestamp;
    }
    mapping(uint256 => HireRecord[]) public hireHistory;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        AgentType agentType,
        uint256 signalPrice
    );

    event AgentHired(
        uint256 indexed agentId,
        address indexed coordinator,
        string pair,
        uint256 paidUSDC
    );

    event SignalRecorded(
        uint256 indexed agentId,
        string verdict,
        bool wasCorrect
    );

    function registerAgent(
        string memory name,
        string memory description,
        string memory strategy,
        AgentType agentType,
        address agentWallet,
        uint256 signalPriceUSDC
    ) external returns (uint256) {

        require(bytes(name).length > 0, "Name required");
        require(bytes(strategy).length > 0, "Strategy required");
        require(signalPriceUSDC >= 100000, 
                "Min price is $0.10 USDC");
        require(signalPriceUSDC <= 10000000, 
                "Max price is $10.00 USDC");

        uint256 id = agentCount++;

        agents[id] = Agent({
            id: id,
            owner: msg.sender,
            agentWallet: agentWallet,
            name: name,
            description: description,
            agentType: agentType,
            status: AgentStatus.ACTIVE,
            signalPriceUSDC: signalPriceUSDC,
            totalHires: 0,
            totalEarned: 0,
            correctSignals: 0,
            totalSignals: 0,
            strategy: strategy,
            registeredAt: block.timestamp,
            lastActiveAt: block.timestamp
        });

        ownerAgents[msg.sender].push(id);

        emit AgentRegistered(
            id, msg.sender, name, agentType, signalPriceUSDC
        );
        return id;
    }

    function recordHire(
        uint256 agentId,
        address coordinator,
        string memory pair,
        uint256 paidUSDC,
        string memory verdict
    ) external {
        Agent storage agent = agents[agentId];
        require(agent.status == AgentStatus.ACTIVE);

        agent.totalHires++;
        agent.totalEarned += paidUSDC;
        agent.totalSignals++;
        agent.lastActiveAt = block.timestamp;

        hireHistory[agentId].push(HireRecord({
            coordinator: coordinator,
            pair: pair,
            paidUSDC: paidUSDC,
            verdict: verdict,
            wasCorrect: false,
            timestamp: block.timestamp
        }));

        emit AgentHired(agentId, coordinator, pair, paidUSDC);
    }

    function recordAccuracy(
        uint256 agentId,
        uint256 hireIndex,
        bool wasCorrect
    ) external {
        if (wasCorrect) {
            agents[agentId].correctSignals++;
        }
        hireHistory[agentId][hireIndex].wasCorrect = wasCorrect;
        emit SignalRecorded(agentId, 
            hireHistory[agentId][hireIndex].verdict, 
            wasCorrect
        );
    }

    function pauseAgent(uint256 agentId) external {
        require(agents[agentId].owner == msg.sender);
        agents[agentId].status = AgentStatus.PAUSED;
    }

    function getAgent(uint256 id) 
        external view returns (Agent memory) {
        return agents[id];
    }

    function getOwnerAgents(address owner)
        external view returns (uint256[] memory) {
        return ownerAgents[owner];
    }

    function getAgentAccuracy(uint256 id)
        external view returns (uint256) {
        Agent memory a = agents[id];
        if (a.totalSignals == 0) return 0;
        return (a.correctSignals * 100) / a.totalSignals;
    }

    function getTopAgents(uint256 limit)
        external view returns (Agent[] memory) {
        // Return top agents sorted by totalEarned
        // Simple implementation: return first N active agents
        uint256 count = agentCount < limit ? agentCount : limit;
        Agent[] memory top = new Agent[](count);
        for (uint256 i = 0; i < count; i++) {
            top[i] = agents[i];
        }
        return top;
    }
}

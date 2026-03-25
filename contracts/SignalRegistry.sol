// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SignalRegistry {
    struct Signal {
        address user;
        string pair;
        string verdict;      // "BUY" | "SELL" | "HOLD"
        uint8 confidence;    // 0-100
        string riskLevel;    // "safe" | "moderate" | "degen"
        bool riskApproved;
        uint256 timestamp;
    }

    Signal[] public signals;
    mapping(address => uint256[]) public userSignals;

    event SignalRecorded(
        address indexed user,
        string pair,
        string verdict,
        uint8 confidence,
        uint256 indexed signalId
    );

    function recordSignal(
        string memory pair,
        string memory verdict,
        uint8 confidence,
        string memory riskLevel,
        bool riskApproved
    ) external returns (uint256) {
        uint256 id = signals.length;
        signals.push(Signal({
            user: msg.sender,
            pair: pair,
            verdict: verdict,
            confidence: confidence,
            riskLevel: riskLevel,
            riskApproved: riskApproved,
            timestamp: block.timestamp
        }));
        userSignals[msg.sender].push(id);
        emit SignalRecorded(msg.sender, pair, verdict, confidence, id);
        return id;
    }

    function getUserSignals(address user) external view returns (uint256[] memory) {
        return userSignals[user];
    }

    function getSignal(uint256 id) external view returns (Signal memory) {
        return signals[id];
    }

    function totalSignals() external view returns (uint256) {
        return signals.length;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PortfolioReport {

    enum TokenVerdict { HOLD, SELL, ADD }

    struct TokenAnalysis {
        string symbol;        // "ETH"
        string pair;          // "ETH/USDC"
        uint256 balance;      // raw token balance
        uint256 valueUSDC;    // estimated value in USDC * 1e6
        TokenVerdict verdict; // HOLD / SELL / ADD
        uint8 confidence;     // 0-100
        string reasoning;     // plain english
        uint8 portfolioWeight;// % of total portfolio
    }

    struct Report {
        uint256 id;
        address wallet;
        uint256 totalValueUSDC;   // total portfolio value
        uint8 overallHealth;      // 0-100 score
        string healthLabel;       // "Strong" / "Caution" / "Danger"
        uint256 sellCount;        // how many tokens to sell
        uint256 holdCount;        // how many tokens to hold
        uint256 addCount;         // how many tokens to add to
        TokenAnalysis[] tokens;
        uint256 createdAt;
    }

    mapping(uint256 => Report) public reports;
    mapping(address => uint256[]) public userReports;
    uint256 public reportCount;

    event ReportGenerated(
        uint256 indexed reportId,
        address indexed wallet,
        uint256 totalValueUSDC,
        uint8 overallHealth,
        uint256 tokenCount
    );

    function saveReport(
        uint256 totalValueUSDC,
        uint8 overallHealth,
        string memory healthLabel,
        string[] memory symbols,
        string[] memory pairs,
        uint256[] memory balances,
        uint256[] memory valuesUSDC,
        uint8[] memory verdicts,
        uint8[] memory confidences,
        string[] memory reasonings,
        uint8[] memory weights
    ) external returns (uint256) {

        uint256 id = reportCount++;
        Report storage report = reports[id];

        report.id = id;
        report.wallet = msg.sender;
        report.totalValueUSDC = totalValueUSDC;
        report.overallHealth = overallHealth;
        report.healthLabel = healthLabel;
        report.createdAt = block.timestamp;

        uint256 sellCount = 0;
        uint256 holdCount = 0;
        uint256 addCount = 0;

        for (uint i = 0; i < symbols.length; i++) {
            TokenVerdict v = TokenVerdict(verdicts[i]);
            report.tokens.push(TokenAnalysis({
                symbol: symbols[i],
                pair: pairs[i],
                balance: balances[i],
                valueUSDC: valuesUSDC[i],
                verdict: v,
                confidence: confidences[i],
                reasoning: reasonings[i],
                portfolioWeight: weights[i]
            }));
            if (v == TokenVerdict.SELL) sellCount++;
            else if (v == TokenVerdict.HOLD) holdCount++;
            else addCount++;
        }

        report.sellCount = sellCount;
        report.holdCount = holdCount;
        report.addCount = addCount;

        userReports[msg.sender].push(id);

        emit ReportGenerated(
            id, msg.sender, totalValueUSDC,
            overallHealth, symbols.length
        );

        return id;
    }

    function getUserReports(address user)
        external view returns (uint256[] memory) {
        return userReports[user];
    }

    function getReport(uint256 id)
        external view returns (
            address wallet,
            uint256 totalValueUSDC,
            uint8 overallHealth,
            string memory healthLabel,
            uint256 sellCount,
            uint256 holdCount,
            uint256 addCount,
            uint256 createdAt,
            uint256 tokenCount
        ) {
        Report storage r = reports[id];
        return (
            r.wallet, r.totalValueUSDC, r.overallHealth,
            r.healthLabel, r.sellCount, r.holdCount,
            r.addCount, r.createdAt, r.tokens.length
        );
    }

    function getReportToken(uint256 reportId, uint256 tokenIndex)
        external view returns (TokenAnalysis memory) {
        return reports[reportId].tokens[tokenIndex];
    }
}

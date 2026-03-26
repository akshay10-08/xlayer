// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TradeJournal {

    enum TradeStatus { OPEN, CLOSED, CANCELLED }
    enum TradeSide { BUY, SELL }

    struct Trade {
        uint256 id;
        address trader;
        string pair;           // "ETH/USDC"
        TradeSide side;        // BUY or SELL
        uint256 entryPrice;    // stored as price * 1e6
        uint256 exitPrice;     // 0 if still open
        uint256 positionSize;  // in USDC * 1e6
        uint8 signalConfidence;// 0-100
        int256 pnl;            // final P&L in USDC * 1e6
        TradeStatus status;
        uint256 openedAt;
        uint256 closedAt;      // 0 if still open
        string notes;          // optional user note
    }

    // tradeId => Trade
    mapping(uint256 => Trade) public trades;
    
    // wallet => array of trade IDs
    mapping(address => uint256[]) public userTrades;
    
    // wallet => stats
    mapping(address => uint256) public totalTrades;
    mapping(address => uint256) public winningTrades;
    mapping(address => int256)  public totalPnL;
    
    uint256 public globalTradeCount;

    event TradeOpened(
        uint256 indexed tradeId,
        address indexed trader,
        string pair,
        TradeSide side,
        uint256 entryPrice,
        uint256 positionSize
    );

    event TradeClosed(
        uint256 indexed tradeId,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl
    );

    function openTrade(
        string memory pair,
        TradeSide side,
        uint256 entryPrice,
        uint256 positionSize,
        uint8 signalConfidence,
        string memory notes
    ) external returns (uint256) {
        uint256 id = globalTradeCount++;
        
        trades[id] = Trade({
            id: id,
            trader: msg.sender,
            pair: pair,
            side: side,
            entryPrice: entryPrice,
            exitPrice: 0,
            positionSize: positionSize,
            signalConfidence: signalConfidence,
            pnl: 0,
            status: TradeStatus.OPEN,
            openedAt: block.timestamp,
            closedAt: 0,
            notes: notes
        });

        userTrades[msg.sender].push(id);
        totalTrades[msg.sender]++;
        globalTradeCount++;

        emit TradeOpened(
            id, msg.sender, pair, side, 
            entryPrice, positionSize
        );
        return id;
    }

    function closeTrade(
        uint256 tradeId,
        uint256 exitPrice
    ) external {
        Trade storage trade = trades[tradeId];
        require(trade.trader == msg.sender, "Not your trade");
        require(trade.status == TradeStatus.OPEN, "Not open");

        trade.exitPrice = exitPrice;
        trade.closedAt = block.timestamp;
        trade.status = TradeStatus.CLOSED;

        // Calculate P&L
        // positionSize is in USDC, prices have 6 decimal places
        int256 priceDiff = int256(exitPrice) - int256(trade.entryPrice);
        
        if (trade.side == TradeSide.SELL) {
            priceDiff = -priceDiff; // reverse for shorts
        }
        
        // P&L = positionSize * (exitPrice - entryPrice) / entryPrice
        trade.pnl = (int256(trade.positionSize) * priceDiff) 
                    / int256(trade.entryPrice);

        totalPnL[msg.sender] += trade.pnl;
        
        if (trade.pnl > 0) {
            winningTrades[msg.sender]++;
        }

        emit TradeClosed(tradeId, msg.sender, exitPrice, trade.pnl);
    }

    function getUserTrades(address user) 
        external view returns (uint256[] memory) {
        return userTrades[user];
    }

    function getTrade(uint256 id) 
        external view returns (Trade memory) {
        return trades[id];
    }

    function getUserStats(address user) external view returns (
        uint256 total,
        uint256 wins,
        int256 pnl,
        uint256 winRate  // 0-100
    ) {
        total = totalTrades[user];
        wins = winningTrades[user];
        pnl = totalPnL[user];
        winRate = total > 0 ? (wins * 100) / total : 0;
    }

    function getRecentTrades(uint256 limit) 
        external view returns (Trade[] memory) {
        uint256 count = globalTradeCount < limit 
                        ? globalTradeCount : limit;
        Trade[] memory recent = new Trade[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = trades[globalTradeCount - 1 - i];
        }
        return recent;
    }
}

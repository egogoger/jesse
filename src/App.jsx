// src/App.js

import React, { useState } from 'react';
import CandleChartWithControls from './components/CandleChartWithControls';
import TradingSidebar from './components/TradingSidebar';
import './App.css';

function App() {
    const [obfuscate, setObfuscate] = useState(true);
    const [anchorTime, setAnchorTime] = useState(null);
    const [tradeContext, setTradeContext] = useState({
        ticker: null,
        interval: null,
        lastTime: null,
    });

    const handleJumpToTime = (isoTime) => {
        setAnchorTime(isoTime);
    };
    return (
        <div
            className="App"
            style={{
                height: "100vh",
                width: "100vw",
                display: "flex",
                flexDirection: "row",
                overflow: "hidden",
            }}
        >
            <div style={{ flex: 3, height: "100%", overflow: "hidden" }}>
                <CandleChartWithControls
                    obfuscate={obfuscate}
                    onObfuscateChange={setObfuscate}
                    currentAnchorTime={anchorTime}
                    onAnchorTimeChange={setAnchorTime}
                    onReadyForTrading={setTradeContext}
                />
            </div>

            <div
                style={{
                    flex: 1,
                    minWidth: 280,
                    height: "100%",
                    overflowY: "auto",
                    borderLeft: "1px solid #ccc",
                }}
            >
                <TradingSidebar
                    obfuscate={obfuscate}
                    currentTicker={tradeContext.ticker}
                    currentInterval={tradeContext.interval}
                    currentTime={tradeContext.lastTime}
                    onJumpToTime={handleJumpToTime}
                />
            </div>
        </div>
    );
}

export default App;

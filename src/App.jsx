// src/App.js

import React, { useEffect, useMemo, useState } from 'react';
import CandleChartWithControls from './components/CandleChartWithControls';
import TradingSidebar from './components/TradingSidebar';
import './App.css';
import { FUTURES, FUTURES_COMMISSION_PERCENT, STOCKS_COMMISSION_PERCENT } from './utils/consts';

function App() {
    const [openOrder, setOpenOrder] = useState(null);
    const [obfuscate, setObfuscate] = useState(() => {
        const v = localStorage.getItem("obfuscate");
        return !v || v === "true";
    });

    useEffect(() => {
        localStorage.setItem("obfuscate", obfuscate);
    }, [obfuscate]);

    const [anchorTime, setAnchorTime] = useState(null);
    const [tradeContext, setTradeContext] = useState({
        ticker: null,
        interval: null,
        lastTime: null,
        price: null,
    });

    const handleJumpToTime = (isoTime) => {
        setAnchorTime(isoTime);
    };
    
    const commission = useMemo(() => {
        return !tradeContext.ticker || !FUTURES.includes(tradeContext.ticker) ? STOCKS_COMMISSION_PERCENT : FUTURES_COMMISSION_PERCENT;
    }, [tradeContext.ticker]);

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
            <div style={{ flex: 5, height: "100%", overflow: "hidden" }}>
                <CandleChartWithControls
                    obfuscate={obfuscate}
                    onObfuscateChange={setObfuscate}
                    currentAnchorTime={anchorTime}
                    onAnchorTimeChange={setAnchorTime}
                    onReadyForTrading={setTradeContext}
                    openOrder={openOrder}
                    commission={commission}
                />
            </div>

            <div
                style={{
                    flex: 1,
                    width: 200,
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
                    currentPrice={tradeContext.price}
                    onJumpToTime={handleJumpToTime}
                    openOrder={openOrder}
                    setOpenOrder={setOpenOrder}
                    commission={commission}
                />
            </div>
        </div>
    );
}

export default App;

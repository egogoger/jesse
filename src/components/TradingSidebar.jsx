// TradingSidebar.js

import React, { useEffect, useState, useCallback } from "react";
import {
    placeOrder,
    closeOrder,
} from "../api";
import { calculatePnLPercent, getCommission } from "../utils/utils";

// A temporary order object exists ONLY in UI.
// It is saved to DB only on close.
function createLocalOrder(ticker, interval, side, entryTime, entryPrice) {
    return {
        id: null,               // DB ID assigned only when closing
        ticker,
        interval,
        side,                   // "long" or "short"
        entryTime,
        entryPrice,
        exitTime: null,
        exitPrice: null,
        pnl: 0,
        status: "open",
    };
}

export default function TradingSidebar({
    obfuscate,
    currentTicker,
    currentInterval,
    currentTime,
    currentPrice,   // you must pass c.c from your candle renderer
    onJumpToTime,
    openOrder,
    setOpenOrder,
    commission,
}) {
    const [closedOrders, setClosedOrders] = useState([]);

    // --------------------------------------------------------------
    //                   ACTION: BUY (Long)
    // --------------------------------------------------------------

    const handleBuy = useCallback(() => {
        if (!currentTicker || !currentTime || !currentPrice) return;

        if (openOrder && openOrder.side === "short") {
            handleCloseOrder(); // Close short instead
            return;
        }

        // open a new long position locally
        setOpenOrder(
            createLocalOrder(
                currentTicker,
                currentInterval,
                "long",
                currentTime,
                currentPrice
            )
        );
    }, [currentTicker, currentInterval, currentTime, currentPrice, openOrder]);

    // --------------------------------------------------------------
    //                   ACTION: SELL (Short)
    // --------------------------------------------------------------

    const handleSell = useCallback(() => {
        if (!currentTicker || !currentTime || !currentPrice) return;

        if (openOrder && openOrder.side === "long") {
            handleCloseOrder(); // Close long instead
            return;
        }

        // open a new short position locally
        setOpenOrder(
            createLocalOrder(
                currentTicker,
                currentInterval,
                "short",
                currentTime,
                currentPrice
            )
        );
    }, [currentTicker, currentInterval, currentTime, currentPrice, openOrder]);

    // --------------------------------------------------------------
    //     UPDATE PnL LIVE WHEN PRICE CHANGES (open order only)
    // --------------------------------------------------------------

    useEffect(() => {
        if (!openOrder) return;
        if (!currentPrice) return;

        let pnl =
            openOrder.side === "long"
                ? currentPrice - openOrder.entryPrice
                : openOrder.entryPrice - currentPrice;

        setOpenOrder((prev) => ({
            ...prev,
            pnl,
        }));
    }, [currentPrice]);

    // --------------------------------------------------------------
    //                     CLOSE ORDER (SAVED TO DB)
    // --------------------------------------------------------------

    const handleCloseOrder = useCallback(async () => {
        if (!openOrder) return;

        const exitPrice = currentPrice;
        const exitTime = currentTime;

        const pnl =
            openOrder.side === "long"
                ? exitPrice - openOrder.entryPrice
                : openOrder.entryPrice - exitPrice;

        // send to backend now (order is permanently stored)
        const result = await closeOrderOnBackend({
            ...openOrder,
            exitPrice,
            exitTime,
            pnl,
        });

        setClosedOrders((prev) => [...prev, result]);
        setOpenOrder(null);
    }, [openOrder, currentPrice, currentTime]);

    async function closeOrderOnBackend(order) {
        // When closing, save into DB:
        // 1) placeOrder() → writes entry
        // 2) closeOrder() → fills exit + pnl
        const entry = await placeOrder({
            ticker: order.ticker,
            interval: order.interval,
            side: order.side,
            size: 1,
            placedAtISO: order.entryTime,
        });

        const closed = await closeOrder(entry.id, {
            exitTimeISO: order.exitTime,
        });

        return closed;
    }

    // --------------------------------------------------------------
    //                 KEYBOARD SHORTCUTS: Q = Buy, R = Sell
    // --------------------------------------------------------------

    const handleKey = useCallback((e) => {
        if (e.target.tagName === "INPUT") return;

        const key = e.key.toLowerCase();

        if (key === "q") handleBuy();
        if (key === "r") handleSell();
    }, [handleBuy, handleSell]);

    useEffect(() => {
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [handleKey]);

    // --------------------------------------------------------------
    //                   DISPLAY HELPERS
    // --------------------------------------------------------------

    const fmt = (n) => (n == null ? "" : n.toFixed(2));

    const obf = (val) => (obfuscate ? "***" : val);

    // --------------------------------------------------------------
    //                   COMPONENT RENDER
    // --------------------------------------------------------------

    return (
        <div style={{ padding: 8, height: "100%", overflowY: "auto" }}>
            <h3>Trading</h3>

            <strong>Current</strong>
            <div>Ticker: {obf(currentTicker)}</div>
            <div>Interval: {obf(currentInterval)}</div>
            <div>Time: {obf(currentTime)}</div>
            <div>Price: {fmt(currentPrice)}</div>
            <div>Commission: {obf(commission)}%</div>

            <hr />

            <button onClick={handleBuy} style={{ width: "50%" }}>
                Buy (Q)
            </button>

            <button onClick={handleSell} style={{ width: "50%", marginBottom: 12 }}>
                Sell (R)
            </button>

            {/* OPEN ORDER */}
            {openOrder && (
                <div style={{ border: "1px solid #ddd", padding: 8, marginBottom: 16 }}>
                    <h4>Open Order</h4>
                    <div>Side: {openOrder.side}</div>
                    <div>Entry Price: {fmt(openOrder.entryPrice)}</div>
                    <div>Entry Time: {obf(openOrder.entryTime)}</div>
                    <div>Current PnL: {fmt(openOrder.pnl)}</div>

                    <button
                        style={{ marginTop: 8, width: "100%" }}
                        onClick={handleCloseOrder}
                    >
                        Close
                    </button>
                </div>
            )}

            {/* CLOSED ORDERS */}
            <h4>Closed Orders</h4>
            {closedOrders.length === 0 && <div>No closed orders</div>}

            {closedOrders.map((o) => (
                <div
                    key={o.id}
                    style={{ border: "1px solid #eee", padding: 6, marginBottom: 6 }}
                >
                    <div>{obf(o.ticker)} {o.side}</div>
                    <div>Entry: {fmt(o.entryPrice)}</div>
                    <div>Exit: {fmt(o.exitPrice)}</div>
                    <div>PnL: {fmt(calculatePnLPercent(o.entryPrice, o.exitPrice, getCommission(o.ticker)))}%</div>

                    <button
                        style={{ marginTop: 4, width: "100%" }}
                        onClick={() => onJumpToTime(o.entryTime)}
                    >
                        Go to Time
                    </button>
                </div>
            ))}
        </div>
    );
}

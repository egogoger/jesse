// src/components/TradingSidebar.js

import React, { useEffect, useState, useMemo } from 'react';
import { fetchOrders, placeOrder, closeOrder, addMoreToOrder } from '../api';

export default function TradingSidebar({
    obfuscate,
    currentTicker,
    currentInterval,
    currentTime, // last visible candle time (real ISO)
    onJumpToTime,
}) {
    const [ordersOpen, setOrdersOpen] = useState([]);
    const [ordersClosed, setOrdersClosed] = useState([]);
    const [side, setSide] = useState('long');
    const [size, setSize] = useState(1);
    const [loading, setLoading] = useState(false);

    const loadOrders = async () => {
        try {
            const { open, closed } = await fetchOrders();
            setOrdersOpen(open || []);
            setOrdersClosed(closed || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadOrders();
    }, []);

    const latestOpenOrder = useMemo(
        () =>
            ordersOpen.length
                ? ordersOpen[ordersOpen.length - 1]
                : null,
        [ordersOpen]
    );

    const handlePlaceOrder = async () => {
        if (!currentTicker || !currentTime) return;
        setLoading(true);
        try {
            await placeOrder({
                ticker: currentTicker,
                interval: currentInterval,
                side,
                size: Number(size),
                placedAtISO: currentTime,
            });
            await loadOrders();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseLatest = async () => {
        if (!latestOpenOrder) return;
        setLoading(true);
        try {
            await closeOrder(latestOpenOrder.id);
            await loadOrders();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMoreSameDirection = async () => {
        if (!latestOpenOrder) return;
        setLoading(true);
        try {
            await addMoreToOrder(latestOpenOrder.id, Number(size));
            await loadOrders();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderTicker = (t) => {
        if (!t) return '';
        return obfuscate ? '***' : t;
    };

    const renderDate = (iso) => {
        if (!iso) return '';
        return obfuscate ? '****-**-** **:**' : new Date(iso).toLocaleString();
    };

    const renderPnL = (pnl) => {
        if (pnl == null) return '';
        return pnl.toFixed(2);
    };

    return (
        <div style={{ padding: 8, borderLeft: '1px solid #ccc', height: '100%', overflowY: 'auto' }}>
            <h3>Trading</h3>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginBottom: 16,
                }}
            >
                <div>
                    <strong>Current context</strong>
                    <div>Ticker: {renderTicker(currentTicker)}</div>
                    <div>Interval: {currentInterval}</div>
                    <div>Time: {renderDate(currentTime)}</div>
                </div>

                <div>
                    <label>
                        Side:&nbsp;
                        <select value={side} onChange={(e) => setSide(e.target.value)}>
                            <option value="long">Long</option>
                            <option value="short">Short</option>
                        </select>
                    </label>
                </div>

                <div>
                    <label>
                        Size:&nbsp;
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            style={{ width: 80 }}
                        />
                    </label>
                </div>

                <button onClick={handlePlaceOrder} disabled={loading || !currentTime}>
                    Place order
                </button>

                <button onClick={handleCloseLatest} disabled={loading || !latestOpenOrder}>
                    Close current order
                </button>

                <button
                    onClick={handleAddMoreSameDirection}
                    disabled={loading || !latestOpenOrder}
                >
                    Add more (same direction)
                </button>

                {loading && <span>Saving…</span>}
            </div>

            <h4>Open orders</h4>
            <OrdersTable
                orders={ordersOpen}
                obfuscate={obfuscate}
                onJumpToTime={onJumpToTime}
                titleEmpty="No open orders"
            />

            <h4 style={{ marginTop: 16 }}>Closed orders</h4>
            <OrdersTable
                orders={ordersClosed}
                obfuscate={obfuscate}
                onJumpToTime={onJumpToTime}
                titleEmpty="No closed orders"
                showPnL
            />
        </div>
    );
}

function OrdersTable({ orders, obfuscate, onJumpToTime, titleEmpty, showPnL }) {
    const renderTicker = (t) => (obfuscate ? '***' : t);
    const renderDate = (iso) =>
        obfuscate ? '****-**-** **:**' : new Date(iso).toLocaleString();

    if (!orders.length) {
        return <div>{titleEmpty}</div>;
    }

    return (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Ticker</th>
                    <th style={th}>Side</th>
                    <th style={th}>Size</th>
                    {showPnL && <th style={th}>PnL</th>}
                    <th style={th}>Actions</th>
                </tr>
            </thead>
            <tbody>
                {orders.map((o) => (
                    <tr key={o.id}>
                        <td style={td}>{renderDate(o.entryTime)}</td>
                        <td style={td}>{renderTicker(o.ticker)}</td>
                        <td style={td}>{o.side}</td>
                        <td style={td}>{o.size}</td>
                        {showPnL && <td style={td}>{o.pnl != null ? o.pnl.toFixed(2) : ''}</td>}
                        <td style={td}>
                            <button
                                onClick={() => onJumpToTime && onJumpToTime(o.entryTime)}
                                style={{ fontSize: 11 }}
                            >
                                Go to candles
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const th = {
    borderBottom: '1px solid #ccc',
    textAlign: 'left',
    padding: '2px 4px',
};

const td = {
    borderBottom: '1px solid #eee',
    padding: '2px 4px',
};

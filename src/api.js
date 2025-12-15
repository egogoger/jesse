// src/api.js

const API_BASE = '/api';

// ---- Candles ----

// random period with at least 500 future candles
// GET  /api/candles/random?ticker=XXX&interval=5min
export async function fetchRandomCandles({ ticker, interval }) {
    const res = await fetch(
        `${API_BASE}/candles/random?ticker=${encodeURIComponent(
            ticker
        )}&interval=${encodeURIComponent(interval)}`
    );
    if (!res.ok) throw new Error('Failed to load candles');
    return res.json(); // { candles: [...], hasMorePast: bool, hasMoreFuture: bool }
}

// load more candles to the left (older)
// GET /api/candles/before?ticker=...&interval=...&before=ISO&limit=500
export async function fetchMorePastCandles({ ticker, interval, before, limit = 500 }) {
    const res = await fetch(
        `${API_BASE}/candles/before?ticker=${encodeURIComponent(
            ticker
        )}&interval=${encodeURIComponent(interval)}&before=${encodeURIComponent(
            before
        )}&limit=${limit}`
    );
    if (!res.ok) throw new Error('Failed to load more candles');
    return res.json(); // { candles: [...], hasMorePast: bool }
}

export async function fetchAlignedCandles({ ticker, interval, targetTime }) {
    const params = new URLSearchParams({
        ticker,
        interval,
        targetTime,
    });

    const res = await fetch(`/api/candles/aligned?${params.toString()}`);
    if (!res.ok) {
        throw new Error('Failed to fetch aligned candles');
    }
    return res.json(); // returns { candles, hasMorePast, hasMoreFuture }
}

// GET /api/meta/tickers -> ["IMOEXF", "SOMEOTHER", ...]
export async function fetchTickers() {
    const res = await fetch(`${API_BASE}/meta/tickers`);
    if (!res.ok) throw new Error('Failed to load tickers');
    return res.json();
}

// GET /api/meta/intervals?ticker=IMOEXF -> ["5min", "1h", "1d", ...]
export async function fetchIntervals(ticker) {
    const res = await fetch(
        `${API_BASE}/meta/intervals?ticker=${encodeURIComponent(ticker)}`
    );
    if (!res.ok) throw new Error('Failed to load intervals');
    return res.json();
}

// ---- Orders ----

// GET /api/orders -> { open: [...], closed: [...] }
export async function fetchOrders() {
    const res = await fetch(`${API_BASE}/orders`);
    if (!res.ok) throw new Error('Failed to load orders');
    return res.json();
}

// POST /api/orders { ticker, side, size, placedAtISO }
export async function placeOrder(order) {
    const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Failed to place order');
    return res.json();
}

// POST /api/orders/:id/close
export async function closeOrder(orderId, body) {
    const res = await fetch(`${API_BASE}/orders/${orderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to close order');
    return res.json();
}

// POST /api/orders/:id/add-more { size }
export async function addMoreToOrder(orderId, size) {
    const res = await fetch(`${API_BASE}/orders/${orderId}/add-more`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size }),
    });
    if (!res.ok) throw new Error('Failed to add to order');
    return res.json();
}

import { fileURLToPath } from "url";
import path from "path";
import Database from "better-sqlite3";

// Absolute path to the current module file
const modulePath = fileURLToPath(import.meta.url);

// Absolute path of the executed file (node filename.js)
const entryPath = path.resolve(process.argv[1]);

/**
 * Check if this module is run directly.
 *
 * Works on:
 *  - Windows (C:\path\file.js)
 *  - Linux/macOS (/home/user/file.js)
 *  - Paths containing: spaces, Unicode, percent-encoding
 *  - When node is executed via absolute or relative paths
 */
const isMain = modulePath === entryPath;

const API_URL = "https://api-invest-gw.tinkoff.ru/market-data-history/api/public/v1/candles";

const TICKER_MAP = {
    IMOEXF: "5bcff194-f10d-4314-b9ee-56b7fdb344fd",
    GAZP: "962e2a95-02a9-4171-abd7-aa198dbe643a",
    GMKN: "509edd0c-129c-4ee2-934d-7f6246126da1",
    IRKT: "509edd0c-129c-4ee2-934d-7f6246126da1",
    LKOH: "02cfdf61-6298-4c0f-a9ca-9cabc82afaf3",
    MAGN: "cfb50a23-2465-497e-bc7e-e4f0e042cf3d",
    MGNT: "7132b1c9-ee26-4464-b5b5-1046264b61d9",
    MOEX: "ca845f68-6c43-44bc-b584-330d2a1e5eb7",
    MTLR: "5e1c2634-afc4-4e50-ad6d-f78fc14a539a",
    MTSS: "eb4ba863-e85f-4f80-8c29-f2627938ee58",
    NLMK: "cd8063ad-73ad-4b31-bd0d-93138d9e99a2",
    NVTK: "0da66728-6c30-44c4-9264-df8fac2467ee",
    OZON: "161eb0d0-aaac-4451-b374-f5d0eeb1b508",
    PIKK: "75e003c2-ca14-4980-8d7b-e82ec6b6ffe1",
    PLZL: "03d5e771-fc10-438e-8892-85a40733612d",
    PMSB: "10620843-28ce-44e8-80c2-f26ceb1bd3e1",
    POSI: "4d8209f9-3b75-437d-ad5f-2906d56f27e9",
    RNFT: "de08affe-4fbd-454e-9fd1-46a81b23f870",
    ROSN: "c7485564-ed92-45fd-a724-1214aa202904",
    SBER: "fd417230-19cf-4e7b-9623-f7c9ca18ec6b",
    SELG: "e6123145-9665-43e0-8413-cd61b8aa9b13",
    SGZH: "0d28c01b-f841-4e89-9c92-0ee23d12883a",
    SMLT: "7bedd86b-478d-4742-a28c-29d27f8dbc7d",
    SPBE: "4d813ab1-8bc9-4670-89ea-12bfbab6017d",
    T: "15dc2120-29d2-48b8-87c0-da1d95255f68",
    TATN: "87db07bc-0e02-4e29-90bb-05e8ef791d7b",
    TRMK: "88468f6c-c67a-4fb4-a006-53eed803883c",
    UGLD: "278d9ccc-4dde-484e-bf79-49ce8f733470",
    UPRO: "664921c5-b552-47a6-9ced-8735a3c6ca8a",
    UWGN: "17017bf0-ed5c-47be-8fae-c0cedbfabe32",
    VTBR: "8e2b0325-0292-4654-8a18-4f63ed3b0e09",
    X5: "0964acd0-e2cb-4810-a177-ef4ad8856ff0",
    YDEX: "7de75794-a27f-4d81-a39b-492345813822",
};

const INTERVALS = ["5min", "hour", "day"];

/**
 * (Optional) seriesUid mapping if required by some instruments.
 */
const SERIES_UID_MAP = {
    IMOEXF: "68a241d2-dd2f-4e99-bae2-edc6d163e957",
};

const db = new Database("jesse.db");

db.exec(`
CREATE TABLE IF NOT EXISTS candles (
    ticker TEXT,
    interval TEXT,
    time TEXT,
    o REAL,
    h REAL,
    l REAL,
    c REAL,
    v INTEGER,
    vb INTEGER,
    vs INTEGER,
    PRIMARY KEY (ticker, interval, time)
);
`);

const insertStmt = db.prepare(`
INSERT OR REPLACE INTO candles
(ticker, interval, time, o, h, l, c, v, vb, vs)
VALUES (@ticker, @interval, @time, @o, @h, @l, @c, @v, @vb, @vs);
`);

const latestTimeStmt = db.prepare(`
SELECT time FROM candles
WHERE ticker = ? AND interval = ?
ORDER BY time DESC LIMIT 1;
`);

/**
 * Fetch a single page of candles
 */
async function fetchCandlePage(instrument_id, interval, to, seriesUid) {
    const params = new URLSearchParams({
        instrument_id,
        interval,
        limit: "600",
        appName: "invest_terminal",
        appVersion: "2.0.0",
        sessionId: SESSION_ID,
    });

    if (seriesUid) params.set("seriesUid", seriesUid);
    if (to) params.set("to", to);

    const url = `${API_URL}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${url}`);
    }

    return res.json();
}

/**
 * Full backfill (no candles exist yet)
 */
async function backfillAllCandles(ticker, instrument_id, interval, seriesUid) {
    let allCandles = [];
    let nextTo = null;
    let page = 1;

    while (true) {
        const data = await fetchCandlePage(instrument_id, interval, nextTo, seriesUid);
        const candles = data.payload?.candles ?? [];

        console.log(`Backfill page #${page}: ${candles.length} candles`);

        allCandles.push(...candles);

        if (data.payload.has_prev_candles && candles.length > 0) {
            nextTo = candles[0].time;
            page++;
            await new Promise(r => setTimeout(r, 80));
        } else {
            break;
        }
    }

    allCandles.sort((a, b) => new Date(a.time) - new Date(b.time));

    // 🚫 Remove the most recent candle (last in time)
    if (allCandles.length > 0) {
        allCandles.pop();
    }

    const tx = db.transaction(() => {
        for (const c of allCandles) {
            insertStmt.run({
                ticker,
                interval,
                time: c.time,
                o: c.o,
                h: c.h,
                l: c.l,
                c: c.c,
                v: c.v,
                vb: c.vb,
                vs: c.vs,
            });
        }
    });

    tx();

    console.log(`Saved ${allCandles.length} candles.`);
}

/**
 * Incremental update (fetch only missing newest candles)
 */
async function updateMissingCandles(
    ticker,
    instrument_id,
    interval,
    lastTimeStr,
    seriesUid
) {
    const lastTime = new Date(lastTimeStr);
    let newCandles = [];
    let nextTo = null;
    let page = 1;

    console.log(`Updating since: ${lastTimeStr}`);

    while (true) {
        const data = await fetchCandlePage(instrument_id, interval, nextTo, seriesUid);
        const candles = data.payload?.candles ?? [];

        console.log(`Update page #${page}: ${candles.length} candles`);

        for (const c of candles) {
            const t = new Date(c.time);
            if (t > lastTime) newCandles.push(c);
        }

        const oldest = candles.length ? new Date(candles[0].time) : null;

        if (!data.payload.has_prev_candles || !oldest || oldest <= lastTime) {
            break;
        }

        nextTo = candles[0].time;
        page++;
        await new Promise(r => setTimeout(r, 80));
    }

    if (newCandles.length === 0) {
        console.log("No new candles.");
        return;
    }

    newCandles.sort((a, b) => new Date(a.time) - new Date(b.time));
    // 🚫 Remove the most recent candle (last in time)
    if (newCandles.length > 0) {
        newCandles.pop();
    }
    const tx = db.transaction(() => {
        for (const c of newCandles) {
            insertStmt.run({
                ticker,
                interval,
                time: c.time,
                o: c.o,
                h: c.h,
                l: c.l,
                c: c.c,
                v: c.v,
                vb: c.vb,
                vs: c.vs,
            });
        }
    });

    tx();

    console.log(`Inserted ${newCandles.length} new candles.`);
}

export async function loadAllCandlesFor(ticker, interval) {
    if (!SESSION_ID) throw new Error('Provide Session ID');
    const instrument_id = TICKER_MAP[ticker];
    if (!instrument_id) throw new Error(`Unknown ticker: ${ticker}`);

    const seriesUid = SERIES_UID_MAP[ticker];

    console.log(`Loading ${ticker}, interval ${interval}`);

    const row = latestTimeStmt.get(ticker, interval);

    if (!row) {
        console.log("No data yet, performing full backfill...");
        await backfillAllCandles(ticker, instrument_id, interval, seriesUid);
    } else {
        console.log("Performing incremental update...");
        await updateMissingCandles(
            ticker,
            instrument_id,
            interval,
            row.time,
            seriesUid
        );
    }
}


export async function loadAllCandles() {
    const tickers = Object.keys(TICKER_MAP);

    for (const ticker of tickers) {
        for (const interval of INTERVALS) {
            console.log(`\n=== Loading ${ticker} @ ${interval} ===`);
            await loadAllCandlesFor(ticker, interval);
        }
    }

    console.log("\nAll tickers and intervals updated.");
}

let SESSION_ID = null;

if (isMain) {
    console.log(
        "Usage:\n\tnode candles.js IMOEXF 5min <SESSION_ID>\n\tnode candles.js ALL <SESSION_ID>"
    );

    if (process.argv[2] === "ALL") {
        SESSION_ID = process.argv[3];
        if (!SESSION_ID) {
            console.error("Error: SESSION_ID is required");
            process.exit(1);
        }
        await loadAllCandles();
    } else {
        const ticker = process.argv[2];
        const interval = process.argv[3];
        SESSION_ID = process.argv[4];

        if (!ticker || !interval || !SESSION_ID) {
            console.error("Error: Missing arguments");
            process.exit(1);
        }

        await loadAllCandlesFor(ticker, interval);
    }
}

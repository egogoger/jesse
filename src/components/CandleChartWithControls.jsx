// src/components/CandleChartWithControls.js

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import {
    fetchTickers,
    fetchIntervals,
    fetchRandomCandles,
    fetchMorePastCandles,
} from '../api';
import { calculateRSI } from '../utils/rsi';

const LOCAL_STORAGE_FF_KEY = 'ffSpeedMs';

function obfuscateTime(realISO, offsetDays) {
    const t = new Date(realISO).getTime();
    const shifted = t + offsetDays * 24 * 3600 * 1000;
    return new Date(shifted).toISOString();
}

function tickMarkFormatter(time) {
    const date = new Date(time * 1000);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function syncAllCrosshairs(allCharts, allSeries) {
    /**
    * Syncs the crosshair position from a source chart to all target charts.
    * @param {IChartApi} sourceChart The chart that generated the event.
    * @param {IChartApi[]} allCharts Array of all charts to sync.
    * @param {{chart: IChartApi, series: ISeriesApi}[]} allSeries Array of all series mappings.
    * @param {MouseParams} param The event parameters.
    */
    function syncCrosshairs(sourceChart, allCharts, allSeries, param) {
        const sourceSeriesConfig = allSeries.find(c => c.chart === sourceChart);
        if (!sourceSeriesConfig) {
            console.warn('[syncCrosshairs] No series config');
            return;
        }

        const dataPoint = getCrosshairDataPoint(sourceSeriesConfig.series, param);

        for (let index = 0; index < allCharts.length; index++) {
            const targetChart = allCharts[index];
            // Do not update the chart that generated the event
            if (targetChart === sourceChart) continue;
            const targetSeries = allSeries[index].series;
            if (dataPoint) {
                // Set the crosshair position on the target chart:
                // 1. We use the 'value' from the source data point (this sets the horizontal position).
                //    NOTE: Since the charts have different price scales, the horizontal line placement will look wrong.
                //    To sync only the vertical time line (the most important part), pass 'null' for the value.
                // 2. We use the 'time' from the source data point (this sets the vertical position).
                // 3. We pass the 'targetSeries' so its price label updates correctly based on the synced time.

                // Option 1: Sync only the vertical time line (RECOMMENDED for different data)
                const time = dataPoint.time;
                targetChart.setCrosshairPosition(null, time, targetSeries);

                // Option 2: Sync both lines (Only works well if charts have the same price scale)
                // const { value, time } = dataPoint;
                // targetChart.setCrosshairPosition(value, time, targetSeries); 
            } else {
                // Mouse has moved out, clear the programmatic crosshair on the target chart
                targetChart.clearCrosshairPosition();
            }
        }
    }
    /**
     * Finds the data point (time and value) for the crosshair's position 
     * on the series that triggered the event.
     * @param {ISeriesApi} series The series to check against.
     * @param {MouseParams} param The event parameters from subscribeCrosshairMove.
     * @returns {{time: Time, value: number} | null}
     */
    function getCrosshairDataPoint(series, param) {
        // If there's no time, the mouse is out or the event is irrelevant
        if (!param.time) {
            console.warn('[getCrosshairDataPoint] No time');
            return null;
        }
        return param.seriesData.get(series) || null;
    }

    // Attach the synchronization function to all charts' crosshairMove events
    allCharts[0].subscribeCrosshairMove(param => syncCrosshairs(allCharts[0], allCharts, allSeries, param));
    allCharts[1].subscribeCrosshairMove(param => syncCrosshairs(allCharts[1], allCharts, allSeries, param));
    allCharts[2].subscribeCrosshairMove(param => syncCrosshairs(allCharts[2], allCharts, allSeries, param));
}

export default function CandleChartWithControls({
    obfuscate,
    onObfuscateChange,
    currentAnchorTime,
    onAnchorTimeChange,
    onReadyForTrading, // gives back { ticker, interval, lastTime }
}) {
    const [tickers, setTickers] = useState([]);
    const [intervals, setIntervals] = useState([]);
    const [selectedTicker, setSelectedTicker] = useState('');
    const [selectedInterval, setSelectedInterval] = useState('');
    const [candles, setCandles] = useState([]); // raw from DB
    const [visibleEndIndex, setVisibleEndIndex] = useState(0); // index of last revealed candle
    const [hasMorePast, setHasMorePast] = useState(false);
    const [ffSpeed, setFfSpeed] = useState(
        Number(localStorage.getItem(LOCAL_STORAGE_FF_KEY)) || 300
    );
    const [isFFRunning, setIsFFRunning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [randomOffsetDays] = useState(() => 10000); // fixed per mount

    const candleChartContainerRef = useRef(null);
    const rsiChartContainerRef = useRef(null);
    const volChartContainerRef = useRef(null);

    const candleChartRef = useRef(null);
    const candleSeriesRef = useRef(null);

    const rsiChartRef = useRef(null);
    const rsiSeriesRef = useRef(null);

    const volChartRef = useRef(null);
    const volSeriesRef = useRef(null);

    // load tickers on mount
    useEffect(() => {
        (async () => {
            try {
                const t = await fetchTickers();
                setTickers(t);
                if (t.length) setSelectedTicker((prev) => prev || t[0]);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    // load intervals when ticker changes
    useEffect(() => {
        if (!selectedTicker) return;
        (async () => {
            try {
                const ints = await fetchIntervals(selectedTicker);
                setIntervals(ints);
                if (ints.length) setSelectedInterval((prev) => prev || ints[0]);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [selectedTicker]);

    // load random candles when ticker/interval changes OR when reset is requested
    const loadRandomSeries = useCallback(async () => {
        if (!selectedTicker || !selectedInterval) return;
        setLoading(true);
        setIsFFRunning(false);

        try {
            const { candles: newCandles, hasMorePast: morePast } =
                await fetchRandomCandles({
                    ticker: selectedTicker,
                    interval: selectedInterval,
                });

            setCandles(newCandles);
            // Reveal first ~100 candles initially (or all if fewer)
            const initialVisible = Math.min(newCandles.length - 1, 1500);
            setVisibleEndIndex(initialVisible);
            setHasMorePast(morePast);

            const last = newCandles[initialVisible];
            if (last && onAnchorTimeChange) {
                onAnchorTimeChange(last.time);
            }
            if (last && onReadyForTrading) {
                onReadyForTrading({
                    ticker: selectedTicker,
                    interval: selectedInterval,
                    lastTime: last.time,
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedTicker, selectedInterval, onAnchorTimeChange, onReadyForTrading]);

    useEffect(() => {
        loadRandomSeries();
    }, [loadRandomSeries]);

    // Init charts
    useEffect(() => {
        if (!candleChartContainerRef.current) return;

        // Candle chart
        const candleChart = createChart(candleChartContainerRef.current, {
            timeScale: {
                rightOffset: 2,
                barSpacing: 6,
                fixLeftEdge: false,
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#333',
                tickMarkFormatter,
            },
        });
        const candleSeries = candleChart.addCandlestickSeries();
        candleChartRef.current = candleChart;
        candleSeriesRef.current = candleSeries;

        // RSI chart
        const rsiChart = createChart(rsiChartContainerRef.current, {
            timeScale: {
                rightOffset: 2,
                barSpacing: 6,
                fixLeftEdge: false,
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#333',
                tickMarkFormatter,
            },
            rightPriceScale: {
                autoScale: false,
                minValue: 0,
                maxValue: 100,
            },
        });
        const rsiSeries = rsiChart.addLineSeries();
        rsiChartRef.current = rsiChart;
        rsiSeriesRef.current = rsiSeries;

        // Volume chart
        const volChart = createChart(volChartContainerRef.current, {
            timeScale: {
                rightOffset: 2,
                barSpacing: 6,
                fixLeftEdge: false,
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#333',
                tickMarkFormatter,
            },
        });
        const volSeries = volChart.addHistogramSeries();
        volChartRef.current = volChart;
        volSeriesRef.current = volSeries;
        volSeriesRef.current.applyOptions({
            priceFormat: {
                type: 'custom',
                formatter: (val) => {
                    if (val == null) return '';
                    const abs = Math.abs(val);

                    if (abs >= 1_000_000_000) return (val / 1_000_000_000).toFixed(2) + 'B';
                    if (abs >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
                    if (abs >= 1_000) return (val / 1_000).toFixed(2) + 'K';
                    return String(val);
                },
            },
        });

        // Resize handler
        const handleResize = () => {
            const width = candleChartContainerRef.current.clientWidth;
            candleChart.applyOptions({ width });
            rsiChart.applyOptions({ width });
            volChart.applyOptions({ width });
        };
        window.addEventListener('resize', handleResize);

        // Infinite scroll to left
        candleChartRef.current.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (!range || !candles?.length) return;

            const from = range.from;
            const oldestLoaded = new Date(candles[0].time).getTime() / 1000;

            // load more if we are within 2–3 candles of the boundary
            if (from <= oldestLoaded + 60) {
                loadMorePast();
            }
        });

        const syncTimeScale = (sourceChart, targetChart) => {
            sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (!range) return;
                targetChart.timeScale().setVisibleLogicalRange(range);
            });
        };

        // Sync candles → RSI and candles → Volume
        syncTimeScale(candleChart, rsiChart);
        syncTimeScale(candleChart, volChart);

        rsiChart.applyOptions({ handleScroll: false });
        volChart.applyOptions({ handleScroll: false });

        syncAllCrosshairs([candleChartRef.current, rsiChartRef.current, volChartRef.current], [
            { chart: candleChartRef.current, series: candleSeriesRef.current },
            { chart: rsiChartRef.current, series: rsiSeriesRef.current },
            { chart: volChartRef.current, series: volSeriesRef.current },
        ]);

        return () => {
            window.removeEventListener('resize', handleResize);
            candleChart.remove();
            rsiChart.remove();
            volChart.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // helper: transform candles for chart, respecting obfuscation & visibleEndIndex
    const getVisibleCandles = useCallback(() => {
        const sliced = candles.slice(0, visibleEndIndex + 1);
        return sliced.map((c, idx) => ({
            ...c,
            displayTime: obfuscate
                ? obfuscateTime(c.time, randomOffsetDays)
                : c.time,
            logicalIndex: idx,
        }));
    }, [candles, visibleEndIndex, obfuscate, randomOffsetDays]);

    // update charts whenever candles / visibility / obfuscation changes
    useEffect(() => {
        if (!candleSeriesRef.current) return;
        const visible = getVisibleCandles();
        const toTs = t => Math.floor(new Date(obfuscate ? obfuscateTime(t, randomOffsetDays) : t).getTime() / 1000);
        candleSeriesRef.current.setData(
            visible.map((c) => ({
                time: toTs(c.displayTime),
                open: c.o,
                high: c.h,
                low: c.l,
                close: c.c,
            }))
        );

        // BEFORE
        const rsiValues = calculateRSI(visible); // length = visible.length - period
        const period = 14;
        const fullRSI = visible.map((c, idx) => {
            if (idx < period) {
                return { time: toTs(c.displayTime), value: 0 };
            }
            const r = rsiValues[idx - period];
            return {
                time: toTs(c.displayTime),
                value: r.value,
            };
        });
        rsiSeriesRef.current?.setData(fullRSI);

        if (volSeriesRef.current) {
            volSeriesRef.current.setData(
                visible.map((c) => {
                    const isUp = c.c > c.o;
                    const isDown = c.c < c.o;

                    return {
                        time: toTs(c.displayTime),
                        value: c.v,
                        color: isUp ? "#26a69a" : isDown ? "#ef5350" : "#999999",
                    };
                })
            );

        }

        const lastVisible = visible[visible.length - 1];
        if (lastVisible && onAnchorTimeChange) {
            onAnchorTimeChange(lastVisible.time);
        }
        if (lastVisible && onReadyForTrading) {
            onReadyForTrading({
                ticker: selectedTicker,
                interval: selectedInterval,
                lastTime: lastVisible.time,
            });
        }
    }, [
        candles,
        visibleEndIndex,
        obfuscate,
        randomOffsetDays,
        getVisibleCandles,
        onAnchorTimeChange,
        onReadyForTrading,
        selectedTicker,
        selectedInterval,
    ]);

    // Fast-forward logic
    useEffect(() => {
        if (!isFFRunning) return;
        if (visibleEndIndex >= candles.length - 1) {
            setIsFFRunning(false);
            return;
        }

        const id = setTimeout(() => {
            setVisibleEndIndex((idx) => Math.min(idx + 1, candles.length - 1));
        }, ffSpeed);

        return () => clearTimeout(id);
    }, [isFFRunning, visibleEndIndex, candles.length, ffSpeed]);

    const handleTickerChange = (e) => {
        setSelectedTicker(e.target.value);
    };

    const handleIntervalChange = (e) => {
        setSelectedInterval(e.target.value);
    };

    const handleToggleFF = () => {
        setIsFFRunning((prev) => !prev);
    };

    const handleFfSpeedChange = (e) => {
        const value = Number(e.target.value) || 0;
        setFfSpeed(value);
        localStorage.setItem(LOCAL_STORAGE_FF_KEY, String(value));
    };

    const handleReset = () => {
        loadRandomSeries();
    };

    // load more candles to left
    const loadMorePast = useCallback(async () => {
        if (!candles.length || !selectedTicker || !selectedInterval) return;
        const oldest = candles[0];
        try {
            const { candles: more, hasMorePast: morePast } = await fetchMorePastCandles({
                ticker: selectedTicker,
                interval: selectedInterval,
                before: oldest.time,
                limit: 500,
            });
            if (more && more.length) {
                setCandles((prev) => [...more, ...prev]);
                setVisibleEndIndex((prevIdx) => prevIdx + more.length);
                setHasMorePast(morePast);
                candleChartRef.current.timeScale().scrollToPosition(0);
            } else {
                setHasMorePast(false);
            }
        } catch (e) {
            console.error(e);
        }
    }, [candles, selectedTicker, selectedInterval]);

    // allow external jump to specific time (for order buttons)
    useEffect(() => {
        if (!currentAnchorTime || !candles.length) return;

        const idx = candles.findIndex((c) => c.time === currentAnchorTime);
        if (idx !== -1) {
            setVisibleEndIndex(idx);
        }
    }, [currentAnchorTime, candles]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: "100%" }}>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>
                    Ticker:&nbsp;
                    {obfuscate ? '***' : <select value={selectedTicker} onChange={handleTickerChange}>
                        {tickers.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>}
                </label>

                <label>
                    Interval:&nbsp;
                    <select value={selectedInterval} onChange={handleIntervalChange}>
                        {intervals.map((iv) => (
                            <option key={iv} value={iv}>
                                {iv}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    <input
                        type="checkbox"
                        checked={obfuscate}
                        onChange={(e) => onObfuscateChange(e.target.checked)}
                    />{' '}
                    Obfuscate dates / ticker
                </label>

                <button onClick={handleToggleFF} disabled={!candles.length}>
                    {isFFRunning ? 'Pause FF' : 'Fast Forward'}
                </button>

                <label>
                    FF speed (ms):&nbsp;
                    <input
                        type="number"
                        min="50"
                        step="50"
                        value={ffSpeed}
                        onChange={handleFfSpeedChange}
                        style={{ width: 80 }}
                    />
                </label>

                <button onClick={handleReset} disabled={loading}>
                    Reset period
                </button>

                {loading && <span>Loading…</span>}
            </div>

            {/* Charts */}
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div
                    ref={candleChartContainerRef}
                    style={{ flex: 3, width: "100%", border: "1px solid #ccc" }}
                />
                <div
                    ref={rsiChartContainerRef}
                    style={{ flex: 1.5, width: "100%", border: "1px solid #ccc" }}
                />
                <div
                    ref={volChartContainerRef}
                    style={{ flex: 1, width: "100%", border: "1px solid #ccc" }}
                />
            </div>
        </div>
    );
}

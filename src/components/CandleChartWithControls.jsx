// src/components/CandleChartWithControls.jsx

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { calculateRSI } from '../utils/rsi';
import {
    obfuscateTime,
    snapTimeToInterval,
    buildSyntheticCandle
} from '../utils/chartHelpers';

import { useMarketData } from '../hooks/useMarketData';
import { useChartPlayer } from '../hooks/useChartPlayer';

import ChartControls from './ChartControls';
import TradingCharts from './TradingCharts';

export default function CandleChartWithControls({
    obfuscate,
    onObfuscateChange,
    currentAnchorTime,
    onAnchorTimeChange,
    onReadyForTrading,
}) {
    const [randomOffsetDays] = useState(() => 10000);
    const isSwitchingIntervalRef = useRef(false);

    // Custom Hooks
    const {
        tickers, intervals,
        selectedTicker, setSelectedTicker,
        selectedInterval, setSelectedInterval,
        candles, setCandles,
        loading,
        loadRandomSeries, loadMorePast
    } = useMarketData(currentAnchorTime);

    const {
        visibleEndIndex, setVisibleEndIndex,
        isFFRunning, setIsFFRunning,
        ffSpeed, toggleFF, changeSpeed
    } = useChartPlayer(candles.length);

    // ВАЖНО: Функция handleReset должна явно сбрасывать якорь, если мы хотим "прыгнуть" в новое рандомное место.
    const handleReset = useCallback(async () => {
        setIsFFRunning(false);
        const newCandles = await loadRandomSeries();

        if (newCandles && newCandles.length) {
            const initialVisible = Math.min(newCandles.length - 1, 1500);
            setVisibleEndIndex(initialVisible);

            const last = newCandles[initialVisible];
            if (last) {
                if (onAnchorTimeChange) onAnchorTimeChange(last.time);
                if (onReadyForTrading) {
                    onReadyForTrading({
                        ticker: selectedTicker,
                        interval: selectedInterval,
                        lastTime: last.time,
                    });
                }
            }
        }
    }, [loadRandomSeries, onAnchorTimeChange, onReadyForTrading, selectedTicker, selectedInterval, setIsFFRunning, setVisibleEndIndex]);

    // Auto-load on mount/change
    useEffect(() => {
        handleReset();
    }, [handleReset]);


    // Handlers
    const handleIntervalChange = (val) => {
        if (currentAnchorTime) {
            const snapped = snapTimeToInterval(currentAnchorTime, val);
            onAnchorTimeChange(snapped);
        }
        isSwitchingIntervalRef.current = true;
        setSelectedInterval(val);
    };

    const handleLoadMorePast = useCallback(async (visibleFromTime) => {
        if (!candles.length) return;
        const oldestLoaded = new Date(candles[0].time).getTime() / 1000;

        // Trigger load if within 60 seconds of edge
        if (visibleFromTime <= oldestLoaded + 60) {
            const addedCount = await loadMorePast();
            if (addedCount > 0) {
                setVisibleEndIndex(prev => prev + addedCount);
                // Note: Chart scrollToPosition(0) is tricky in separated component, 
                // usually lightweight-charts handles prepended data well if time scale is preserved.
            }
        }
    }, [candles, loadMorePast, setVisibleEndIndex]);

    // External Jump (Order Buttons)
    useEffect(() => {
        if (!currentAnchorTime || !candles.length) return;
        const idx = candles.findIndex((c) => c.time === currentAnchorTime);
        if (idx !== -1) {
            setVisibleEndIndex(idx);
        }
    }, [currentAnchorTime, candles, setVisibleEndIndex]);

    // --- DATA PREPARATION FOR CHARTS ---
    const { chartCandles, chartRsi, chartVol } = useMemo(() => {
        let sliced = candles.slice(0, visibleEndIndex + 1);

        // Synthetic candle logic
        if (!isFFRunning && sliced.length > 2) {
            const realLast = sliced[sliced.length - 1];
            // assuming 'candles' are updated real-time or just historical, 
            // logic copied from original:
            const synthetic = buildSyntheticCandle(realLast, realLast, selectedInterval);
            if (synthetic) {
                sliced = [...sliced.slice(0, -1), synthetic];
            }
        }

        const visible = sliced.map((c, idx) => ({
            ...c,
            displayTime: obfuscate ? obfuscateTime(c.time, randomOffsetDays) : c.time,
            logicalIndex: idx,
        }));

        const toTs = t => Math.floor(new Date(t).getTime() / 1000);

        // Format for Candle Series
        const cData = visible.map(c => ({
            time: toTs(c.displayTime),
            open: c.o, high: c.h, low: c.l, close: c.c,
        }));

        // Format for RSI
        const rsiValues = calculateRSI(visible);
        const period = 14;
        const rData = visible.map((c, idx) => {
            if (idx < period) return { time: toTs(c.displayTime), value: 0 };
            return { time: toTs(c.displayTime), value: rsiValues[idx - period]?.value || 0 };
        });

        // Format for Volume
        const vData = visible.map(c => {
            const isUp = c.c > c.o;
            const isDown = c.c < c.o;
            return {
                time: toTs(c.displayTime),
                value: c.v,
                color: isUp ? "#26a69a" : isDown ? "#ef5350" : "#999999",
            };
        });

        return { chartCandles: cData, chartRsi: rData, chartVol: vData, lastVisible: visible[visible.length - 1] };
    }, [candles, visibleEndIndex, isFFRunning, selectedInterval, obfuscate, randomOffsetDays]);

    // Notify Parent about Time Updates
    useEffect(() => {
        if (!chartCandles.length) return;
        const lastVisible = candles[Math.min(visibleEndIndex, candles.length - 1)]; // raw candle time
        if (!lastVisible) return;

        if (onAnchorTimeChange) {
            if (isSwitchingIntervalRef.current) {
                isSwitchingIntervalRef.current = false;
            } else {
                onAnchorTimeChange(lastVisible.time);
            }
        }
        if (onReadyForTrading) {
            onReadyForTrading({
                ticker: selectedTicker,
                interval: selectedInterval,
                lastTime: lastVisible.time,
            });
        }
    }, [visibleEndIndex, candles, onAnchorTimeChange, onReadyForTrading, selectedTicker, selectedInterval]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKey = (e) => {
            if (e.target.tagName === "INPUT") return;
            const key = e.key.toLowerCase();
            if (key === "f") toggleFF();
            if (key === "x") handleReset();
            if (key === "o") onObfuscateChange(prev => !prev);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [toggleFF, handleReset, onObfuscateChange]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: "100%" }}>
            <ChartControls
                tickers={tickers}
                intervals={intervals}
                selectedTicker={selectedTicker}
                onTickerChange={setSelectedTicker}
                selectedInterval={selectedInterval}
                onIntervalChange={handleIntervalChange}
                obfuscate={obfuscate}
                onObfuscateChange={onObfuscateChange}
                isFFRunning={isFFRunning}
                onToggleFF={toggleFF}
                ffSpeed={ffSpeed}
                onFfSpeedChange={changeSpeed}
                onReset={handleReset}
                loading={loading}
                hasData={candles.length > 0}
            />

            <TradingCharts
                candles={chartCandles}
                rsiData={chartRsi}
                volData={chartVol}
                onLoadMorePast={handleLoadMorePast}
            />
        </div>
    );
}
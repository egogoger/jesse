// src/components/CandleChartWithControls.jsx

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { calculateRSI } from '../utils/rsi';
import {
    obfuscateTime,
    snapTimeToInterval,
    buildSyntheticCandle
} from '../utils/chartHelpers';
import { INITIAL_LOOKBACK_CANDLES_AMOUNT, OBFUSCATE_DAYS_OFFSET, RESET_INTERVAL, THEME } from '../utils/consts';

import { useMarketData } from '../hooks/useMarketData';
import { useChartPlayer } from '../hooks/useChartPlayer';

import ChartControls from './ChartControls';
import TradingCharts from './TradingCharts';
import { getItemAfterWeekend, getRandomArrayItem } from '../utils/utils';

export default function CandleChartWithControls({
    obfuscate,
    onObfuscateChange,
    currentAnchorTime,
    onAnchorTimeChange,
    onReadyForTrading,
    openOrder,
    commission,
}) {
    const isSwitchingIntervalRef = useRef(false);
    const isInitiallyPrepared = useRef(false);

    // Custom Hooks
    const {
        tickers, intervals,
        selectedTicker, setSelectedTicker,
        selectedInterval, setSelectedInterval,
        candles,
        loading,
        loadRandomSeries, loadMorePast,
    } = useMarketData(currentAnchorTime);

    const {
        visibleEndIndex, setVisibleEndIndex,
        isFFRunning, setIsFFRunning,
        ffSpeed, toggleFF, changeSpeed
    } = useChartPlayer(candles.length);

    const handlePrepare = useCallback(async (ticker, interval) => {
        console.info(`handlePrepare(${ticker}, ${interval})`);
        const newCandles = await loadRandomSeries(ticker, interval);

        if (!newCandles?.length)
            return void console.error('[handlePrepare] No random candles!');

        const initialVisible = Math.min(newCandles.length - 1, INITIAL_LOOKBACK_CANDLES_AMOUNT-1000);
        setVisibleEndIndex(initialVisible);

        const last = getItemAfterWeekend(newCandles, initialVisible);

        if (!last)
            return void console.error('[handlePrepare] No last candle!');
        onAnchorTimeChange?.(last.time);
        // selected ticker and interval are set in loadRandomSeries
        onReadyForTrading?.({
            ticker: ticker,
            interval: interval,
            lastTime: last.time,
            price: last.c,
        });
    }, [loadRandomSeries, onAnchorTimeChange, onReadyForTrading, setVisibleEndIndex]);

    // ВАЖНО: Функция handleReset должна явно сбрасывать якорь, если мы хотим "прыгнуть" в новое рандомное место.
    const handleReset = useCallback(async () => {
        console.info('handleReset');
        setIsFFRunning(false);
        const newTicker = getRandomArrayItem(tickers);
        await handlePrepare(newTicker, RESET_INTERVAL);
    }, [setIsFFRunning, handlePrepare, tickers]);

    useEffect(() => {
        if (!isInitiallyPrepared.current && tickers.length && intervals.length && selectedTicker) {
            handlePrepare(selectedTicker, RESET_INTERVAL);
            isInitiallyPrepared.current = true;
        }
    }, [tickers.length, intervals.length, selectedTicker, isInitiallyPrepared]);

    const handleIntervalChange = (val) => {
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
            displayTime: obfuscate ? obfuscateTime(c.time, OBFUSCATE_DAYS_OFFSET) : c.time,
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
                color: isUp ? THEME.volumeUp : isDown ? THEME.volumeDown : "#999999",
            };
        });

        return { chartCandles: cData, chartRsi: rData, chartVol: vData, lastVisible: visible[visible.length - 1] };
    }, [candles, visibleEndIndex, isFFRunning, selectedInterval, obfuscate]);

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
                price: lastVisible.c,
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
                openOrder={openOrder}
                commission={commission}
            />
        </div>
    );
}
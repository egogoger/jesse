// src/hooks/useMarketData.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTickers, fetchIntervals, fetchRandomCandles, fetchMorePastCandles, fetchAlignedCandles } from '../api';
import { snapTimeToInterval } from '../utils/chartHelpers';

const MAIN_INTERVAL = '5min';

export function useMarketData(currentAnchorTime) {
    const [tickers, setTickers] = useState([]);
    const [intervals, setIntervals] = useState([]);
    const [selectedTicker, setSelectedTicker] = useState('');
    const [selectedInterval, setSelectedInterval] = useState('');
    const [candles, setCandles] = useState([]);
    const [hasMorePast, setHasMorePast] = useState(false);
    const [loading, setLoading] = useState(false);

    // Используем ref, чтобы изменение времени (тиканье) не триггерило перезагрузку,
    // но при смене интервала мы могли узнать, где мы были.
    const anchorTimeRef = useRef(currentAnchorTime);
    useEffect(() => {
        anchorTimeRef.current = currentAnchorTime;
    }, [currentAnchorTime]);

    // Load tickers on mount
    useEffect(() => {
        (async () => {
            try {
                const t = await fetchTickers();
                setTickers(t);
                if (t.length)
                    setSelectedTicker(prev => prev || t[Math.floor(Math.random() * t.length)]);
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    // Load intervals
    useEffect(() => {
        if (!selectedTicker) return;
        (async () => {
            try {
                const ints = await fetchIntervals(selectedTicker);
                setIntervals(ints);
                if (ints.length) setSelectedInterval(prev => prev || ints[0]);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [selectedTicker]);

    // 2. Логика загрузки СЛУЧАЙНОГО периода (для Reset или первого входа)
    const loadRandomSeries = useCallback(async () => {
        if (!selectedTicker || !selectedInterval) return;
        setLoading(true);
        try {
            const { candles: newCandles, hasMorePast: morePast } = await fetchRandomCandles({
                ticker: selectedTicker,
                interval: selectedInterval,
            });
            setCandles(newCandles);
            setHasMorePast(morePast);
            return newCandles;
        } catch (e) {
            console.error(e);
            return [];
        } finally {
            setLoading(false);
        }
    }, [selectedTicker, selectedInterval]);

    // 3. Логика загрузки СИНХРОНИЗИРОВАННОГО периода (при смене таймфрейма)
    const loadAlignedSeries = useCallback(async (targetTime) => {
        if (!selectedTicker || !selectedInterval) return;
        setLoading(true);
        try {
            // 1. Округляем время под новый интервал (например 05:55 -> 05:00 для 1h)
            const snappedTime = snapTimeToInterval(targetTime, selectedInterval);

            // 2. Вызываем новый API метод
            const { candles: newCandles, hasMorePast: morePast } = await fetchAlignedCandles({
                ticker: selectedTicker,
                interval: selectedInterval,
                targetTime: snappedTime.replace(/\.000Z$/, 'Z'),
            });

            setCandles(newCandles);
            setHasMorePast(morePast);
            return newCandles;
        } catch (e) {
            console.error(e);
            return [];
        } finally {
            setLoading(false);
        }
    }, [selectedTicker, selectedInterval]);

    // 4. Главный Effect для переключения данных
    useEffect(() => {
        if (!selectedTicker || !selectedInterval) return;

        // Если у нас уже есть "Якорь" (мы переключаем ТФ в процессе работы)
        if (anchorTimeRef.current) {
            loadAlignedSeries(anchorTimeRef.current);
        } else {
            // Если якоря нет (первая загрузка), берем рандом
            loadRandomSeries();
        }

        // ВАЖНО: В зависимостях НЕТ anchorTimeRef.current, только ticker/interval.
        // Это гарантирует, что эффект сработает только при смене тикера или интервала.
    }, [selectedTicker, selectedInterval, loadRandomSeries, loadAlignedSeries]);

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
                setCandles(prev => [...more, ...prev]);
                setHasMorePast(morePast);
                return more.length;
            } else {
                setHasMorePast(false);
                return 0;
            }
        } catch (e) {
            console.error(e);
            return 0;
        }
    }, [candles, selectedTicker, selectedInterval]);

    return {
        tickers,
        intervals,
        selectedTicker,
        setSelectedTicker,
        selectedInterval,
        setSelectedInterval,
        candles,
        setCandles,
        hasMorePast,
        loading,
        loadRandomSeries,
        loadMorePast
    };
}
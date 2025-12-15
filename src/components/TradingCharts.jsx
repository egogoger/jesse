// src/components/TradingCharts.jsx
import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { tickMarkFormatter, syncAllCrosshairs } from '../utils/chartHelpers';
import { THEME } from '../utils/consts';

export default function TradingCharts({
    candles,
    rsiData,
    volData,
    onLoadMorePast,
    openOrder,
    commission,
}) {
    const candleChartContainerRef = useRef(null);
    const rsiChartContainerRef = useRef(null);
    const candleChartRef = useRef(null);
    const candleSeriesRef = useRef(null);
    const rsiChartRef = useRef(null);
    const rsiSeriesRef = useRef(null);
    const volSeriesRef = useRef(null);
    const entryLineRef = useRef(null);
    const profitLineRef = useRef(null);

    // 1. Инициализация графиков (один раз)
    useEffect(() => {
        if (!candleChartContainerRef.current) return;

        const commonOptions = {
            layout: {
                background: { color: THEME.bg },
                textColor: THEME.text,
            },
            grid: {
                vertLines: { color: THEME.grid },
                horzLines: { color: THEME.grid },
            },
            crosshair: { mode: CrosshairMode.Normal },
            timeScale: {
                rightOffset: 2,
                barSpacing: 6,
                fixLeftEdge: false,
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter,
            },
        };

        // --- Candle Chart ---
        const candleChart = createChart(candleChartContainerRef.current, {
            ...commonOptions,
            rightPriceScale: {
                visible: true,
                borderVisible: false,
                // Add padding to the price scale
                scaleMargins: {
                    top: 0.3,  // 10% padding at top
                    bottom: 0.3, // 10% padding at bottom
                },
            },
        });
        const candleSeries = candleChart.addCandlestickSeries();
        candleSeries.applyOptions({
            upColor: THEME.up,
            downColor: THEME.down,
            wickUpColor: THEME.up,
            wickDownColor: THEME.down,
            borderVisible: false,
        });
        candleChartRef.current = candleChart;
        candleSeriesRef.current = candleSeries;

        // --- RSI Chart ---
        const rsiChart = createChart(rsiChartContainerRef.current, {
            ...commonOptions,
            rightPriceScale: { autoScale: false, minValue: 0, maxValue: 100 },
        });
        const rsiSeries = rsiChart.addLineSeries();
        rsiSeries.applyOptions({
            color: THEME.rsi,
            lineWidth: 2,
        });
        rsiChartRef.current = rsiChart;
        rsiSeriesRef.current = rsiSeries;

        // Линии RSI 70/30
        rsiSeries.createPriceLine({
            price: 70,
            color: 'rgba(255,255,255,0.25)',
            lineStyle: 2,
        });

        rsiSeries.createPriceLine({
            price: 30,
            color: 'rgba(255,255,255,0.25)',
            lineStyle: 2,
        });

        // --- Volume Chart ---
        const volSeries = candleChart.addHistogramSeries({
            priceScaleId: 'vol',
            priceFormat: { type: 'volume' },
            priceLineVisible: false,
            lastValueVisible: false,
        });

        candleChart.priceScale('vol').applyOptions({
            scaleMargins: {
                top: 0.8,   // volume occupies bottom 15%
                bottom: 0,
            },
            visible: false,
        });
        volSeriesRef.current = volSeries;

        // --- Resize ---
        const handleResize = () => {
            if (candleChartContainerRef.current) {
                const width = candleChartContainerRef.current.clientWidth;
                candleChart.applyOptions({ width });
                rsiChart.applyOptions({ width });
            }
        };
        window.addEventListener('resize', handleResize);

        // --- Syncing ---
        const syncTimeScale = (source, target) => {
            source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (range) target.timeScale().setVisibleLogicalRange(range);
            });
        };
        syncTimeScale(candleChart, rsiChart);

        rsiChart.applyOptions({ handleScroll: false });

        syncAllCrosshairs(
            [candleChart, rsiChart],
            [
                { chart: candleChart, series: candleSeries },
                { chart: rsiChart, series: rsiSeries },
            ]
        );

        // --- Infinite Scroll ---
        candleChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (!range) return;
            // Проверка, что нужно подгрузить данные, делегируется родителю или проверяется здесь
            // В данном случае передаем событие наверх, но нужна ссылка на oldestLoaded
            // Для упрощения, логику "когда" можно оставить здесь, но данные брать из пропсов
            if (onLoadMorePast) onLoadMorePast(range.from);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            candleChart.remove();
            rsiChart.remove();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 2. Обновление данных
    useEffect(() => {
        if (candleSeriesRef.current) candleSeriesRef.current.setData(candles);
        if (rsiSeriesRef.current) rsiSeriesRef.current.setData(rsiData);
        if (volSeriesRef.current) volSeriesRef.current.setData(volData);
    }, [candles, rsiData, volData]);

    // 3. Entry price and profit lines on graph
    useEffect(() => {
        if (!candleSeriesRef.current) return;

        // cleanup
        if (entryLineRef.current) {
            candleSeriesRef.current.removePriceLine(entryLineRef.current);
            entryLineRef.current = null;
        }
        if (profitLineRef.current) {
            candleSeriesRef.current.removePriceLine(profitLineRef.current);
            profitLineRef.current = null;
        }

        if (!openOrder) return;

        const isLong = openOrder.side === "long";
        const color = isLong ? "#00c853" : "#ff5252";

        entryLineRef.current = candleSeriesRef.current.createPriceLine({
            price: openOrder.entryPrice,
            color,
            lineWidth: 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: "Entry",
        });

        if (commission <= 0) return;

        const profitPrice = isLong
            ? openOrder.entryPrice + 2 * commission
            : openOrder.entryPrice - 2 * commission;

        profitLineRef.current = candleSeriesRef.current.createPriceLine({
            price: profitPrice,
            color,
            lineWidth: 1,
            lineStyle: 2, // dashed
            axisLabelVisible: true,
            title: "TP",
        });
    }, [openOrder]);

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div ref={candleChartContainerRef} style={{ flex: 8, width: "100%", border: "1px solid #ccc" }} />
            <div ref={rsiChartContainerRef} style={{ flex: 1, width: "100%", border: "1px solid #ccc" }} />
        </div>
    );
}
// src/components/TradingCharts.jsx
import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { tickMarkFormatter, syncAllCrosshairs } from '../utils/chartHelpers';

export default function TradingCharts({ 
    candles, 
    rsiData, 
    volData, 
    onLoadMorePast,
}) {
    const candleChartContainerRef = useRef(null);
    const rsiChartContainerRef = useRef(null);
    const volChartContainerRef = useRef(null);

    const candleChartRef = useRef(null);
    const candleSeriesRef = useRef(null);
    const rsiChartRef = useRef(null);
    const rsiSeriesRef = useRef(null);
    const volChartRef = useRef(null);
    const volSeriesRef = useRef(null);

    // 1. Инициализация графиков (один раз)
    useEffect(() => {
        if (!candleChartContainerRef.current) return;

        const commonOptions = {
            crosshair: { mode: CrosshairMode.Normal },
            timeScale: {
                rightOffset: 2,
                barSpacing: 6,
                fixLeftEdge: false,
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#333',
                tickMarkFormatter,
            },
        };

        // --- Candle Chart ---
        const candleChart = createChart(candleChartContainerRef.current, commonOptions);
        const candleSeries = candleChart.addCandlestickSeries();
        candleChartRef.current = candleChart;
        candleSeriesRef.current = candleSeries;

        // --- RSI Chart ---
        const rsiChart = createChart(rsiChartContainerRef.current, {
            ...commonOptions,
            rightPriceScale: { autoScale: false, minValue: 0, maxValue: 100 },
        });
        const rsiSeries = rsiChart.addLineSeries();
        rsiChartRef.current = rsiChart;
        rsiSeriesRef.current = rsiSeries;
        
        // Линии RSI 70/30
        rsiSeries.createPriceLine({ price: 70, color: 'rgba(255, 0, 0, 0.8)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
        rsiSeries.createPriceLine({ price: 30, color: 'rgba(0, 255, 0, 0.8)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });

        // --- Volume Chart ---
        const volChart = createChart(volChartContainerRef.current, commonOptions);
        const volSeries = volChart.addHistogramSeries();
        volChartRef.current = volChart;
        volSeriesRef.current = volSeries;
        volSeries.applyOptions({
             priceFormat: {
                type: 'custom',
                formatter: (val) => {
                    if (val == null) return '';
                    const abs = Math.abs(val);
                    if (abs >= 1e9) return (val / 1e9).toFixed(2) + 'B';
                    if (abs >= 1e6) return (val / 1e6).toFixed(2) + 'M';
                    if (abs >= 1e3) return (val / 1e3).toFixed(2) + 'K';
                    return String(val);
                },
            },
        });

        // --- Resize ---
        const handleResize = () => {
            if (candleChartContainerRef.current) {
                const width = candleChartContainerRef.current.clientWidth;
                candleChart.applyOptions({ width });
                rsiChart.applyOptions({ width });
                volChart.applyOptions({ width });
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
        syncTimeScale(candleChart, volChart);

        rsiChart.applyOptions({ handleScroll: false });
        volChart.applyOptions({ handleScroll: false });

        syncAllCrosshairs(
            [candleChart, rsiChart, volChart],
            [
                { chart: candleChart, series: candleSeries },
                { chart: rsiChart, series: rsiSeries },
                { chart: volChart, series: volSeries },
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
            volChart.remove();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    // 2. Обновление данных
    useEffect(() => {
        if (candleSeriesRef.current) candleSeriesRef.current.setData(candles);
        if (rsiSeriesRef.current) rsiSeriesRef.current.setData(rsiData);
        if (volSeriesRef.current) volSeriesRef.current.setData(volData);
    }, [candles, rsiData, volData]);

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div ref={candleChartContainerRef} style={{ flex: 8, width: "100%", border: "1px solid #ccc" }} />
            <div ref={rsiChartContainerRef} style={{ flex: 1, width: "100%", border: "1px solid #ccc" }} />
            <div ref={volChartContainerRef} style={{ flex: 1, width: "100%", border: "1px solid #ccc" }} />
        </div>
    );
}
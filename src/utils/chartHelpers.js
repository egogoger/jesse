// src/utils/chartHelpers.js

export const LOCAL_STORAGE_FF_KEY = 'ffSpeedMs';

export function obfuscateTime(realISO, offsetDays) {
    const t = new Date(realISO).getTime();
    const shifted = t + offsetDays * 24 * 3600 * 1000;
    return new Date(shifted).toISOString();
}

export function tickMarkFormatter(time) {
    const date = new Date(time * 1000);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function snapTimeToInterval(iso, interval) {
    const d = new Date(iso);
    if (interval === "5min") d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
    else if (interval === "15min") d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
    else if (interval === "hour") d.setMinutes(0, 0, 0);
    else if (interval === "4hour") d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
    else if (interval === "day") d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

export function getIntervalMs(interval) {
    switch (interval) {
        case "5min": return 5 * 60 * 1000;
        case "15min": return 15 * 60 * 1000;
        case "1h": return 60 * 60 * 1000;
        case "4h": return 4 * 60 * 60 * 1000;
        case "1d": return 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

export function buildSyntheticCandle(realLastCandle, currentLowerCandle, interval) {
    const start = new Date(realLastCandle.time);
    const now = new Date(currentLowerCandle.time);

    if (now.getTime() - start.getTime() >= getIntervalMs(interval)) {
        return null;
    }

    return {
        ...realLastCandle,
        time: realLastCandle.time,
        c: currentLowerCandle.c,
        h: Math.max(realLastCandle.h, currentLowerCandle.h),
        l: Math.min(realLastCandle.l, currentLowerCandle.l),
        synthetic: true,
    };
}

// Логика синхронизации перекрестий
export function syncAllCrosshairs(allCharts, allSeries) {
    function syncCrosshairs(sourceChart, allCharts, allSeries, param) {
        const sourceSeriesConfig = allSeries.find(c => c.chart === sourceChart);
        if (!sourceSeriesConfig) return;

        const dataPoint = param.seriesData.get(sourceSeriesConfig.series) || null;

        for (let index = 0; index < allCharts.length; index++) {
            const targetChart = allCharts[index];
            if (targetChart === sourceChart) continue;
            const targetSeries = allSeries[index].series;
            
            if (dataPoint && param.time) {
                targetChart.setCrosshairPosition(null, dataPoint.time, targetSeries);
            } else {
                targetChart.clearCrosshairPosition();
            }
        }
    }

    allCharts.forEach(chart => {
        chart.subscribeCrosshairMove(param => syncCrosshairs(chart, allCharts, allSeries, param));
    });
}
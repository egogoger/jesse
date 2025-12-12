// src/hooks/useChartPlayer.js
import { useState, useEffect } from 'react';
import { LOCAL_STORAGE_FF_KEY } from '../utils/chartHelpers';

export function useChartPlayer(totalCandlesCount) {
    const [visibleEndIndex, setVisibleEndIndex] = useState(0);
    const [isFFRunning, setIsFFRunning] = useState(false);
    const [ffSpeed, setFfSpeed] = useState(
        Number(localStorage.getItem(LOCAL_STORAGE_FF_KEY)) || 300
    );

    useEffect(() => {
        if (!isFFRunning) return;
        if (visibleEndIndex >= totalCandlesCount - 1) {
            setIsFFRunning(false);
            return;
        }

        const id = setTimeout(() => {
            setVisibleEndIndex((idx) => Math.min(idx + 1, totalCandlesCount - 1));
        }, ffSpeed);

        return () => clearTimeout(id);
    }, [isFFRunning, visibleEndIndex, totalCandlesCount, ffSpeed]);

    const toggleFF = () => setIsFFRunning(prev => !prev);

    const changeSpeed = (newSpeed) => {
        const val = Number(newSpeed) || 0;
        setFfSpeed(val);
        localStorage.setItem(LOCAL_STORAGE_FF_KEY, String(val));
    };

    return {
        visibleEndIndex,
        setVisibleEndIndex,
        isFFRunning,
        setIsFFRunning, // Экспортируем для сброса при загрузке новых данных
        ffSpeed,
        toggleFF,
        changeSpeed
    };
}
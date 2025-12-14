// src/components/ChartControls.jsx
import React from 'react';

export default function ChartControls({
    tickers,
    intervals,
    selectedTicker,
    onTickerChange,
    selectedInterval,
    onIntervalChange,
    obfuscate,
    onObfuscateChange,
    isFFRunning,
    onToggleFF,
    ffSpeed,
    onFfSpeedChange,
    onReset,
    loading,
    hasData,
}) {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
                Ticker:&nbsp;
                {obfuscate ? '***' : (
                    <select value={selectedTicker} onChange={e => onTickerChange(e.target.value)}>
                        {tickers.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                )}
            </label>

            <label>
                Interval:&nbsp;
                <select value={selectedInterval} onChange={e => onIntervalChange(e.target.value)}>
                    {intervals.map((iv) => (
                        <option key={iv} value={iv}>{iv}</option>
                    ))}
                </select>
            </label>

            <label>
                <input
                    type="checkbox"
                    checked={obfuscate}
                    onChange={(e) => onObfuscateChange(e.target.checked)}
                />{' '}
                Obfuscate (O)
            </label>

            <button onClick={onToggleFF} disabled={!hasData}>
                {isFFRunning ? 'Pause FF' : 'Fast Forward'} (F)
            </button>

            <label>
                FF speed (ms):&nbsp;
                <input
                    type="number"
                    min="50"
                    step="50"
                    value={ffSpeed}
                    onChange={e => onFfSpeedChange(e.target.value)}
                    style={{ width: 80 }}
                />
            </label>

            <button onClick={onReset} disabled={loading}>
                Reset period (X)
            </button>

            {loading && <span>Loading…</span>}
        </div>
    );
}
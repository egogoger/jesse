export const THEME = {
    bg: '#1f2d3d',           // фон
    grid: '#2a3a4d',         // сетка
    text: '#cfd8dc',         // текст
    up: '#26a69a',           // зелёные свечи
    down: '#ef5350',         // красные свечи
    volumeUp: 'rgba(38,166,154,0.5)',
    volumeDown: 'rgba(239,83,80,0.5)',
    rsi: '#4aa3ff',
};

const YEARS_REPEAT_IN = 28;
const DAYS_BETWEEN_REPEAT_YEARS = 10227;

export const OBFUSCATE_DAYS_OFFSET = 77*YEARS_REPEAT_IN*DAYS_BETWEEN_REPEAT_YEARS;
export const FUTURES = ['IMOEXF'];
export const FUTURES_COMMISSION_PERCENT = 0.025;
export const STOCKS_COMMISSION_PERCENT = 0.04;
export const INITIAL_LOOKBACK_CANDLES_AMOUNT = 3000;
export const RESET_INTERVAL = '5min';

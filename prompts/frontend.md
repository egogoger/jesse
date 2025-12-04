Having this table in sqlite database and bare create-react-app template
CREATE TABLE IF NOT EXISTS candles (ticker TEXT, interval TEXT, time TEXT, o REAL, h REAL, l REAL, c REAL, v INTEGER, vb INTEGER, vs INTEGER, PRIMARY KEY (ticker, interval, time));

I need you to write a React component that would have the following:
1. Graph with candles
2. An input with all available tickers to choose from
3. An input with all available intervals for this ticker
4. RSI graph below
5. Volume graph below
6. Checkbox to enable/disable obfuscation of candle data (change of dates)
7. Fast forward button to show future candles one by one
8. Input to control FF speed (setting is saved in Localstorage)
9. "Reset" button to re-load candles in a different period
10. More candles are loaded when I scroll to the far left of the candle graph
11. Switching intervals does not randomize candles (meaning if 5min is on 2025-11-10 and then I switch to 1day, that day should also be on 2025-11-10)

Also write another component which would be rendered in the right sidebar that would be dedicated to trading. It should support:
1. Placing an order
2. Closing of current order
3. Placing more orders in the same direction
4. A table with current and closed orders (dates, ticker, PnL). Dates and ticker will be shown after "obfuscation" is disabled
5. Button on each order to load candles for the time it was placed

Details:
1. All orders should be saved in jesse.db (in order to save both random values and actual ones - have a constant value for rand())
2. All candles should also be taken from the db
3. Candles are loaded for a random period of time (with at least a 500 candles in front)

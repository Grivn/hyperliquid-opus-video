// Ticker tiles shown in the "trade everything" scene: [label, coin, dex, category].
// dex 'main' = core Hyperliquid perps, 'xyz' = the trade.xyz HIP-3 exchange.
export const TILES = [
  ['BTC', 'BTC', 'main', 'crypto'], ['ETH', 'ETH', 'main', 'crypto'], ['SOL', 'SOL', 'main', 'crypto'],
  ['HYPE', 'HYPE', 'main', 'crypto'], ['XRP', 'XRP', 'main', 'crypto'],
  ['NVDA', 'NVDA', 'xyz', 'equities'], ['TSLA', 'TSLA', 'xyz', 'equities'], ['AAPL', 'AAPL', 'xyz', 'equities'],
  ['MSFT', 'MSFT', 'xyz', 'equities'], ['META', 'META', 'xyz', 'equities'], ['AMZN', 'AMZN', 'xyz', 'equities'],
  ['GOOGL', 'GOOGL', 'xyz', 'equities'],
  ['GOLD', 'GOLD', 'xyz', 'commodities'], ['SILVER', 'SILVER', 'xyz', 'commodities'], ['WTI OIL', 'CL', 'xyz', 'commodities'],
  ['BRENT', 'BRENTOIL', 'xyz', 'commodities'], ['COPPER', 'COPPER', 'xyz', 'commodities'],
  ['EUR/USD', 'EUR', 'xyz', 'fx'], ['USD/JPY', 'JPY', 'xyz', 'fx'], ['GBP/USD', 'GBP', 'xyz', 'fx'],
  ['SP500', 'SP500', 'xyz', 'indices'], ['XYZ100', 'XYZ100', 'xyz', 'indices'], ['JP225', 'JP225', 'xyz', 'indices'],
  ['KR200', 'KR200', 'xyz', 'indices'],
];
export const coinId = (key, dex) => (dex === 'main' ? key : `${dex}:${key}`);

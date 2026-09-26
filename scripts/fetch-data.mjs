// Refreshes the market-data snapshot in assets/data from public endpoints (network required).
// Afterwards run `node scripts/prep-data.mjs` to rebuild src/generated/data.js.
// Note: numbers baked into scene copy (e.g. $5.69T volume, 2.63M users) live in src/video/scenes.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILES, coinId } from './tiles.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = (f) => path.join(ROOT, 'assets', 'data', f);
const API = 'https://api.hyperliquid.xyz/info';
const STATS = 'https://d2v1fiwobg9w6.cloudfront.net';
const LAND = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_land.geojson';

async function get(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}
const info = (body) => get(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const save = (f, j) => { fs.writeFileSync(D(f), JSON.stringify(j)); console.log('saved', f); };
const now = Date.now();

save('metaAndAssetCtxs.json', await info({ type: 'metaAndAssetCtxs' }));
save('spotMetaAndAssetCtxs.json', await info({ type: 'spotMetaAndAssetCtxs' }));
save('l2_BTC.json', await info({ type: 'l2Book', coin: 'BTC' }));
save('trades_BTC.json', await info({ type: 'recentTrades', coin: 'BTC' }));
save('candles_BTC_15m.json', await info({ type: 'candleSnapshot', req: { coin: 'BTC', interval: '15m', startTime: now - 3 * 86400e3, endTime: now } }));
save('candles_HYPE_1d.json', await info({ type: 'candleSnapshot', req: { coin: 'HYPE', interval: '1d', startTime: Date.UTC(2024, 10, 29), endTime: now } }));

// HIP-3 builder-deployed perp exchanges
const dexs = await info({ type: 'perpDexs' });
save('perpDexs.json', dexs);
for (const d of dexs) if (d && d.name) save(`hip3_${d.name}.json`, await info({ type: 'metaAndAssetCtxs', dex: d.name }));

// official stats backend (volume + user history)
for (const e of ['daily_usd_volume', 'cumulative_new_users']) save(`stats_${e}.json`, await get(`${STATS}/${e}`));

// 48h hourly closes for the ticker-tile sparklines
const spark = {};
for (const [, key, dex] of TILES) {
  const coin = coinId(key, dex);
  const c = await info({ type: 'candleSnapshot', req: { coin, interval: '1h', startTime: now - 48 * 3600e3, endTime: now } });
  spark[coin] = c.map((x) => +x.c);
}
save('sparklines.json', spark);

if (!fs.existsSync(D('ne_110m_land.geojson'))) save('ne_110m_land.geojson', await get(LAND));

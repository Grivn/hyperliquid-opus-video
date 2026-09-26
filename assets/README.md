# 素材来源与许可

| 目录 / 文件 | 内容 | 来源 | 许可 |
|---|---|---|---|
| `brand/logo_wordmark.svg` | Hyperliquid 标志与字标矢量 | hyperliquid.xyz 页头 SVG | Hyperliquid 商标，仅用于本非官方作品 |
| `data/metaAndAssetCtxs.json`、`spotMetaAndAssetCtxs.json`、`perpDexs.json`、`hip3_*.json` | 永续 / 现货 / HIP-3 市场与行情 | `api.hyperliquid.xyz/info`，2026-09-26 | 公开 API 数据 |
| `data/l2_BTC.json`、`trades_BTC.json`、`candles_*.json`、`sparklines.json` | BTC 订单簿、成交、K 线；行情卡片 48 小时走势 | 同上 | 公开 API 数据 |
| `data/stats_daily_usd_volume.json`、`stats_cumulative_new_users.json` | 每日交易量、累计用户（数据截至 2026-04-03） | Hyperliquid 官方统计后端 | 公开数据 |
| `data/ne_110m_land.geojson` | 陆地轮廓（点阵地球） | Natural Earth 110m | 公有领域 |
| `fonts/Geist*.woff2` | Geist、Geist Mono | Google Fonts / Vercel | SIL OFL 1.1，见 `fonts/OFL-geist*.txt` |
| `fonts/InstrumentSerif*.woff2` | Instrument Serif | Google Fonts | SIL OFL 1.1，见 `fonts/OFL-instrumentserif.txt` |

刷新数据快照：`npm run fetch-data`，然后 `npm run prep`。

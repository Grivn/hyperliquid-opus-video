# Hyperliquid Promo · Procedurally Generated

[中文](README.md) | **English**

![Poster](renders/poster.jpg)

64 s · 1920×1080 · 60 fps · 128 BPM. Both the picture (WebGL + Canvas) and the soundtrack (synthesized in code, no samples) are generated programmatically. They share a single beat grid, so every cut, text slam and flash lands on the beat.

- Preview: [renders/preview_720p.mp4](renders/preview_720p.mp4) (720p, 24 MB)
- 1080p60 master, share cut and soundtrack WAV: see [Releases](https://github.com/Grivn/hyperliquid-opus-video/releases)

## Layout

```
src/
  timeline.js        beat grid: BPM, bars, scene list, cue times shared by audio and video
  audio/synth.mjs    soundtrack synthesizer → build/soundtrack.wav + src/generated/events.js
  video/             browser renderer: WebGL particles / globe / post-processing + Canvas 2D scenes
  generated/         script-generated modules, committed for offline rendering: logo.js data.js events.js
scripts/             data fetching and prep, frame-by-frame rendering, video encoding
assets/              inputs: brand vector, market-data snapshot, fonts (sources and licenses in assets/README.md)
lessons/             sound-design tutorial: mini synth + example audio
renders/             preview video and poster
docs/                storyboard
build/               (not committed) rendered frames, soundtrack WAV, master videos
```

## Quick start

Requires Node.js 20+, Google Chrome and ffmpeg. Tested on Apple Silicon macOS, where the GPU path is ANGLE/Metal.

```bash
npm install
npm run build
```

`build` runs the four steps below in order. The whole pipeline takes about 10 minutes:

| Command | What it does |
|---|---|
| `npm run prep` | Extracts the official logo paths and generates `src/generated/data.js` |
| `npm run audio` | Synthesizes the soundtrack and the beat events |
| `npm run render` | Renders 3,840 frames in headless Chrome to `build/frames` (4 motion-blur sub-frames per frame) |
| `npm run encode` | Encodes the master, share cut, 720p preview and poster |

Other commands:

| Command | What it does |
|---|---|
| `npm run fetch-data` | Refreshes the market-data snapshot from the public Hyperliquid API (needs network; the prices in the video will change) |
| `npm run preview` | Starts a local server; open `/src/video/index.html?play` for real-time playback with sound |
| `npm run check-gpu` | Checks WebGL2 and GPU availability in headless Chrome |
| `npm run lesson` | Runs the mini synth from the sound-design tutorial |

To debug single frames: `node scripts/render.mjs --frames 7.6s,30.1s --out /tmp/frames`. If Chrome isn't in the default location, set the `CHROME_PATH` environment variable.

## How it works

- Every frame is a pure function of time, so any frame can be rendered independently and in parallel, with pixel-identical results.
- WebGL2 layer: brand particle ribbons (65,000 points), warp-speed dust, a dotted globe and a grid floor. Post-processing adds bloom, chromatic aberration, glitch slicing, flashes, vignette and 4-sub-frame motion-blur accumulation.
- Canvas 2D layer: kinetic typography across 22 scenes, a real order book and candlestick chart, an isometric architecture diagram, a validator voting ring and more.
- Soundtrack: drums, rolling bass, supersaw chords and lead, pads, arpeggios, risers and impacts, run through Freeverb reverb, ping-pong delay, sidechain, master EQ and true-peak limiting at -10 LUFS.
- Scene-by-scene timing is in [docs/storyboard.md](docs/storyboard.md) and the sound-design walkthrough is in [lessons/sound-design](lessons/sound-design/README.md) (both in Chinese).

## Sources

| Material | Source |
|---|---|
| Logo and wordmark vectors, brand colors `#97FCE3` / `#03211C`, particle-wave motif | hyperliquid.xyz |
| Copy: Infrastructure to House All Finance, 200,000 orders per second, 0.07 s block time, 27 validators, no private investors, 99% of revenue to the Assistance Fund | hyperliquid.xyz, Hyperliquid docs |
| Ticker tiles, sparklines, BTC order book / trades / 15-minute candles, HIP-3 market counts | `api.hyperliquid.xyz/info`, snapshot of 2026-09-26 |
| All-time volume $5.69T, open interest $16.9B, 2.63M users | Hyperliquid API `globalStats`, 2026-09-26 |
| Weekly volume history (Jun 2023 – Apr 2026) | Hyperliquid's official stats backend |
| Land outlines for the globe | Natural Earth 110m (public domain) |
| Fonts | Geist, Geist Mono, Instrument Serif (SIL OFL); Chinese text uses the system font PingFang SC |
| Music and sound effects | Synthesized from scratch in `src/audio/synth.mjs` |

## Notes

- The Hyperliquid name, logo and brand visuals belong to Hyperliquid. This is an unofficial project.
- Market data and statistics are a snapshot from 2026-09-26, shown for illustration only. They are not investment advice.

## License

The code is released under the [MIT License](LICENSE). Third-party assets are not covered by MIT and keep their own licenses:

- The Hyperliquid name, logo and brand visuals are trademarks of Hyperliquid.
- The fonts are licensed under the SIL Open Font License.
- The map data is in the public domain.

Per-asset sources are listed in [assets/README.md](assets/README.md) (Chinese).

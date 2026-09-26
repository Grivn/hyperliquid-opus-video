// Shared beat grid for the soundtrack (audio/synth.mjs) and the visuals (src/*.js).
// Everything is derived from bars/beats so picture and sound stay locked together.

export const BPM = 128;
export const SPB = 60 / BPM;            // seconds per beat (0.46875)
export const BAR = SPB * 4;             // seconds per bar  (1.875)
export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION = 64.0;           // seconds

/** Time in seconds for bar / beat (beat may be fractional). */
export const T = (bar, beat = 0) => (bar * 4 + beat) * SPB;

// Music sections (bars). Drums/bass behaviour is keyed off these.
export const SECTIONS = [
  { id: 'intro',     from: 0,  to: 4  },
  { id: 'drop1',     from: 4,  to: 12 },
  { id: 'breakdown', from: 12, to: 16 },
  { id: 'drop2',     from: 16, to: 24 },
  { id: 'bridge',    from: 24, to: 28 },
  { id: 'final',     from: 28, to: 30 },
  { id: 'outro',     from: 30, to: 35 },
];

// Visual scenes (bars). `to` of the last scene runs past the end.
export const SCENES = [
  { id: 'boot',       from: 0,  to: 1  },
  { id: 'legacy',     from: 1,  to: 2  },
  { id: 'turn',       from: 2,  to: 3  },
  { id: 'build',      from: 3,  to: 4  },
  { id: 'logo',       from: 4,  to: 6  },
  { id: 'tps',        from: 6,  to: 7  },
  { id: 'blocktime',  from: 7,  to: 8  },
  { id: 'every',      from: 8,  to: 9  },
  { id: 'book',       from: 9,  to: 10 },
  { id: 'chart',      from: 10, to: 11 },
  { id: 'custody',    from: 11, to: 12 },
  { id: 'arch',       from: 12, to: 14 },
  { id: 'validators', from: 14, to: 16 },
  { id: 'everything', from: 16, to: 18 },
  { id: 'always',     from: 18, to: 20 },
  { id: 'builders',   from: 20, to: 22 },
  { id: 'scale',      from: 22, to: 24 },
  { id: 'nobody',     from: 24, to: 25 },
  { id: 'flywheel',   from: 25, to: 26 },
  { id: 'owned',      from: 26, to: 28 },
  { id: 'montage',    from: 28, to: 30 },
  { id: 'finale',     from: 30, to: 35 },
];

// Chord progression, one chord per bar, looping every 4 bars (F minor: i - VI - III - VII).
export const CHORDS = [
  { name: 'Fm', root: 41, notes: [53, 56, 60, 65] },
  { name: 'Db', root: 37, notes: [53, 56, 61, 65] },
  { name: 'Ab', root: 44, notes: [51, 56, 60, 63] },
  { name: 'Eb', root: 39, notes: [51, 55, 58, 63] },
];
export const chordAt = (bar) => CHORDS[((Math.floor(bar) % 4) + 4) % 4];

// Terminal boot text (bar 0). Chars are typed at CHAR_DT; audio adds a tick per char.
export const BOOT = {
  start: 0.12,
  charDt: 0.022,
  line1: '> hyperliquid --connect mainnet',
  rows: [
    { k: 'consensus', v: 'HyperBFT', at: T(0, 2.0) },
    { k: 'block time', v: '0.07 s', at: T(0, 2.5) },
    { k: 'throughput', v: '200,000 orders/s', at: T(0, 3.0) },
  ],
};

// Beat-accurate SFX cues shared by picture and sound.
export const CUES = {
  legacyHits: [T(1, 0), T(1, 1), T(1, 2), T(1, 3)],
  legacySlashes: [T(1, 1.5), T(1, 2.5), T(1, 3.5)],
  shatter: T(2, 0),
  turnWords: [T(2, 1), T(2, 2), T(2, 3)],
  drops: [T(4), T(16), T(28)],
  gaps: [[T(3, 3.5), T(4)], [T(15, 3.5), T(16)], [T(27, 3.5), T(28)]],
  builds: [[T(3), T(4)], [T(15), T(16)], [T(27), T(28)]],
  counterRoll: [T(6, 0), T(6, 1)],
  breakdown: T(12),
  nobodyHits: [T(24, 0), T(24, 1.5), T(24, 3)],
  finale: T(30),
  url: T(31, 0),
  end: DURATION,
};

export const secToBar = (t) => t / BAR;
export const sectionAt = (t) => {
  const bar = t / BAR;
  return SECTIONS.find((s) => bar >= s.from && bar < s.to) || SECTIONS[SECTIONS.length - 1];
};

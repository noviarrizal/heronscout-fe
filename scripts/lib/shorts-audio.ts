// Original soundtrack for `pnpm shorts`: a synthesized music bed (100 bpm, C G Am F) that sounds muffled
// over the old site and opens up with the beat on the reveal, plus a whoosh on each cut, a soft pop per
// caption and a chime on the closing call to action. Everything is generated here, so the videos are
// free to post on any platform. The approach (synthesized sound, the beat landing on the reveal, a fixed
// loudness target) follows github.com/mromidev/claude-animated-shorts (MIT); the code is our own.

const SR = 48_000;
const BEAT = 60 / 100;
const BAR = BEAT * 4;

export type SoundPlan = {
  length: number;
  // When the new site appears: a downbeat, where the filter opens and the drums come in.
  drop: number;
  // Closing card: the drums stop.
  outro: number;
  whooshes: { t: number; size: number }[];
  pops: number[];
  chimes: number[];
  // False when an outside track (--music) replaces the bed; the effects still play.
  music: boolean;
};

type Stereo = [Float32Array, Float32Array];

export function soundtrack(plan: SoundPlan): Stereo {
  const n = Math.ceil(plan.length * SR);
  const out: Stereo = [new Float32Array(n), new Float32Array(n)];
  const random = mulberry32(7);
  if (plan.music) music(out, plan, random);
  for (const w of plan.whooshes) whoosh(out, w.t, w.size, random);
  for (const t of plan.pops) add(out, t, pop(), 0.22);
  for (const t of plan.chimes) {
    add(out, t, bell(hz(79)), 0.11, -0.2);
    add(out, t + 0.12, bell(hz(84)), 0.11, 0.2);
  }
  return out;
}

// 16-bit stereo WAV, peak-normalised; the final level is set by loudnorm afterwards.
export function wav([l, r]: Stereo) {
  let peak = 1e-9;
  for (let i = 0; i < l.length; i++) peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
  const k = (0.9 / peak) * 32767;
  const buf = Buffer.alloc(44 + l.length * 4);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + l.length * 4, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(l.length * 4, 40);
  for (let i = 0; i < l.length; i++) {
    buf.writeInt16LE(Math.round(l[i] * k), 44 + i * 4);
    buf.writeInt16LE(Math.round(r[i] * k), 46 + i * 4);
  }
  return buf;
}

const CHORDS = [
  { pad: [60, 64, 67], arp: [72, 76, 79, 84], bass: 36 }, // C
  { pad: [59, 62, 67], arp: [71, 74, 79, 83], bass: 43 }, // G
  { pad: [57, 60, 64], arp: [69, 72, 76, 81], bass: 45 }, // Am
  { pad: [57, 60, 65], arp: [69, 72, 77, 81], bass: 41 }, // F
];
const ARP = [0, 2, 1, 2, 3, 2, 1, 2];

function music(out: Stereo, plan: SoundPlan, random: () => number) {
  const n = out[0].length;
  const keys: Stereo = [new Float32Array(n), new Float32Array(n)];
  const groove: Stereo = [new Float32Array(n), new Float32Array(n)];
  const kicks: number[] = [];

  // Bars are counted from the drop, so the reveal lands on the first beat of a C chord.
  for (let k = -Math.ceil(plan.drop / BAR); plan.drop + k * BAR < plan.length; k++) {
    const t = plan.drop + k * BAR;
    const chord = CHORDS[((k % 4) + 4) % 4];
    for (const note of chord.pad) {
      add(keys, t, pad(hz(note) * 0.998, BAR), 0.045, -0.6);
      add(keys, t, pad(hz(note) * 1.002, BAR), 0.045, 0.6);
    }
    ARP.forEach((step, e) => add(keys, t + (e * BEAT) / 2, pluck(hz(chord.arp[step]), random), 0.09, e % 2 ? 0.3 : -0.3));
    if (k < 0) continue;
    for (let b = 0; b < 4; b++) {
      const tb = t + b * BEAT;
      if (tb >= plan.outro) break;
      add(groove, tb, bass(hz(chord.bass), BEAT * 0.9), 0.16);
      if (b % 2 === 0) {
        add(groove, tb, kick(), 0.5);
        kicks.push(tb);
      } else add(groove, tb, clap(random), 0.12, 0.1);
      add(groove, tb + BEAT / 2, hat(random), 0.05, 0.35);
    }
  }

  openFilter(keys, plan.drop);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // The keys dip under each kick, so the beat stays clear without turning the bed up.
    let duck = 1;
    for (let j = kicks.length - 1; j >= 0; j--) {
      if (kicks[j] > t) continue;
      if (t - kicks[j] < 0.5) duck = 1 - 0.35 * Math.exp(-(t - kicks[j]) / 0.12);
      break;
    }
    const fade = Math.min(1, t / 0.25, (plan.length - t) / 1.8);
    for (const c of [0, 1] as const) out[c][i] += (keys[c][i] * duck + groove[c][i]) * Math.max(0, fade);
  }
}

// Over the old site the keys sound like they come through a wall; the low-pass sweeps open into the drop.
function openFilter(bus: Stereo, drop: number) {
  for (const ch of bus) {
    let a1 = 0;
    let a2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const t = i / SR;
      if (t >= drop) break;
      const fc = t < drop - 0.8 ? 700 : 700 * (16000 / 700) ** ((t - (drop - 0.8)) / 0.8);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
      a1 += a * (ch[i] - a1);
      a2 += a * (a1 - a2);
      ch[i] = a2;
    }
  }
}

function pad(f: number, dur: number) {
  const v = new Float32Array(Math.round((dur + 0.6) * SR));
  const harmonics = Math.max(1, Math.min(8, Math.floor(6000 / f)));
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.35) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.6) : 1);
    let s = 0;
    for (let h = 1; h <= harmonics; h++) s += Math.sin(2 * Math.PI * f * h * t) / h ** 1.6;
    v[i] = s * env;
  }
  return v;
}

// Karplus-Strong plucked string.
function pluck(f: number, random: () => number) {
  const v = new Float32Array(Math.round(1.1 * SR));
  const period = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) buf[i] = prev = 0.5 * (prev + random() * 2 - 1);
  let j = 0;
  for (let i = 0; i < v.length; i++) {
    const next = (j + 1) % period;
    v[i] = buf[j];
    buf[j] = 0.996 * 0.5 * (buf[j] + buf[next]);
    j = next;
  }
  for (let i = 0; i < 2400; i++) v[v.length - 1 - i] *= i / 2400;
  return v;
}

function bass(f: number, dur: number) {
  const v = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.005) * Math.exp(-t / 0.35) * Math.min(1, (dur - t) / 0.05);
    v[i] = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * env;
  }
  return v;
}

function kick() {
  const v = new Float32Array(Math.round(0.45 * SR));
  let phase = 0;
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (48 + 90 * Math.exp(-t / 0.03))) / SR;
    v[i] = Math.sin(phase) * Math.exp(-t / 0.25);
  }
  return v;
}

function clap(random: () => number) {
  const v = new Float32Array(Math.round(0.25 * SR));
  const filter = svf(1500, 0.9);
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    let env = t >= 0.02 ? Math.exp(-(t - 0.02) / 0.06) : 0;
    for (const burst of [0, 0.01, 0.02]) if (t >= burst) env = Math.max(env, Math.exp(-(t - burst) / 0.004));
    v[i] = filter(random() * 2 - 1).band * env;
  }
  return v;
}

function hat(random: () => number) {
  const v = new Float32Array(Math.round(0.08 * SR));
  const filter = svf(7000, 0.7);
  for (let i = 0; i < v.length; i++) v[i] = filter(random() * 2 - 1).high * Math.exp(-i / SR / 0.018);
  return v;
}

function pop() {
  const v = new Float32Array(Math.round(0.09 * SR));
  let phase = 0;
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (600 + 700 * Math.exp(-t / 0.012))) / SR;
    v[i] = (Math.sin(phase) + 0.2 * Math.sin(2 * phase)) * (1 - Math.exp(-t / 0.002)) * Math.exp(-t / 0.03);
  }
  return v;
}

function bell(f: number) {
  const v = new Float32Array(Math.round(1.6 * SR));
  const partials: [number, number, number][] = [
    [1, 1, 0.9],
    [2.76, 0.35, 0.35],
    [5.4, 0.12, 0.15],
  ];
  for (let i = 0; i < v.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [ratio, amp, tau] of partials) s += amp * Math.sin(2 * Math.PI * f * ratio * t) * Math.exp(-t / tau);
    v[i] = s * Math.min(1, t / 0.002);
  }
  return v;
}

// Band-passed noise whose pitch and level rise into `t` and fall after it; a different noise per ear.
function whoosh(out: Stereo, t: number, size: number, random: () => number) {
  const dur = 0.5 + 0.4 * size;
  const start = t - dur * 0.6;
  for (const ch of out) {
    const filter = svf(300, 1.2);
    for (let i = 0; i < dur * SR; i++) {
      const j = Math.round(start * SR) + i;
      const p = i / (dur * SR);
      const rise = Math.sin(Math.PI * p);
      filter.tune(300 * 10 ** rise);
      const env = p < 0.6 ? (p / 0.6) ** 2 : (1 - (p - 0.6) / 0.4) ** 1.5;
      const s = filter(random() * 2 - 1).band * env * 0.5 * size;
      if (j >= 0 && j < ch.length) ch[j] += s;
    }
  }
}

// State-variable filter (topology-preserving), retunable per sample.
function svf(fc: number, q: number) {
  const k = 1 / q;
  let g = 0;
  let a1 = 0;
  let ic1 = 0;
  let ic2 = 0;
  const tune = (f: number) => {
    g = Math.tan((Math.PI * Math.min(f, SR * 0.45)) / SR);
    a1 = 1 / (1 + g * (g + k));
  };
  tune(fc);
  const run = (x: number) => {
    const v3 = x - ic2;
    const v1 = a1 * ic1 + g * a1 * v3;
    const v2 = ic2 + g * v1;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    return { band: v1, low: v2, high: x - k * v1 - v2 };
  };
  return Object.assign(run, { tune });
}

// Adds a mono sound at t seconds, panned -1 (left) to 1 (right).
function add(out: Stereo, t: number, sound: Float32Array, gain: number, pan = 0) {
  const start = Math.round(t * SR);
  const angle = ((pan + 1) * Math.PI) / 4;
  const l = gain * Math.cos(angle) * Math.SQRT2;
  const r = gain * Math.sin(angle) * Math.SQRT2;
  for (let i = Math.max(0, -start); i < sound.length && start + i < out[0].length; i++) {
    out[0][start + i] += sound[i] * l;
    out[1][start + i] += sound[i] * r;
  }
}

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

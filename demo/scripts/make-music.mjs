// An energetic, royalty-free gym track made from scratch: 126 BPM, A minor, four-on-the-floor
// kick, claps, hats, a rolling bass and side-chained chords. 16-bit stereo WAV.
// Usage: node scripts/make-music.mjs  (SECONDS=120 to change the length)
import { writeFileSync } from 'node:fs';

const RATE = 44100;
const SECONDS = Number(process.env.SECONDS ?? 120);
const BPM = 126;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// Am, F, C, G: chord tones (mid range) and bass roots.
const CHORDS = [
  { notes: [57, 60, 64, 69], root: 33 },
  { notes: [53, 57, 60, 65], root: 29 },
  { notes: [55, 60, 64, 67], root: 36 },
  { notes: [55, 59, 62, 67], root: 31 },
].map((c) => ({ notes: c.notes.map(midi), root: midi(c.root) }));

// Deterministic noise.
let seed = 1;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

const total = Math.floor(SECONDS * RATE);
const L = new Float32Array(total);
const R = new Float32Array(total);
let prevNoise = 0;
let lowNoise = 0;

for (let i = 0; i < total; i++) {
  const t = i / RATE;
  const bar = Math.floor(t / BAR);
  const beatPos = (t % BEAT) / BEAT; // 0..1 within the beat
  const sinceBeat = t % BEAT;
  const beatInBar = Math.floor((t % BAR) / BEAT);
  const chord = CHORDS[bar % CHORDS.length];
  const intro = bar < 2; // a filtered build before the drop
  const outro = t > SECONDS - BAR * 2;

  // Kick: pitch drops from 150 Hz to 48 Hz.
  let kick = 0;
  if (!intro) {
    const k = sinceBeat;
    const f = 48 + 102 * Math.exp(-k * 30);
    kick = Math.sin(2 * Math.PI * f * k) * Math.exp(-k * 9);
  }

  // Noise for hats and claps: a crude high-pass (difference) and band-pass.
  const n = noise();
  const high = n - prevNoise;
  prevNoise = n;
  lowNoise += (n - lowNoise) * 0.25;
  const band = n - lowNoise;

  // Closed hats on every 16th, open hat on the off-beat.
  const sixteenth = (t % (BEAT / 4)) / (BEAT / 4);
  const closedHat = high * Math.exp(-sixteenth * (BEAT / 4) * 90) * 0.18;
  const offBeat = beatPos >= 0.5 ? (beatPos - 0.5) * BEAT : null;
  const openHat = offBeat !== null ? high * Math.exp(-offBeat * 22) * 0.35 : 0;

  // Clap on beats 2 and 4: three quick bursts.
  let clap = 0;
  if (!intro && (beatInBar === 1 || beatInBar === 3)) {
    const c = sinceBeat;
    const bursts = [0, 0.011, 0.022].reduce(
      (s, d) => s + (c >= d ? Math.exp(-(c - d) * (d === 0.022 ? 18 : 140)) : 0),
      0,
    );
    clap = band * bursts * 0.55;
  }

  // Rolling bass: off-beat 8ths, saw-like, root of the chord.
  const eighth = (t % (BEAT / 2)) / (BEAT / 2);
  const isOff = Math.floor((t % BEAT) / (BEAT / 2)) === 1;
  let bass = 0;
  if (!intro) {
    const env = Math.exp(-eighth * (BEAT / 2) * (isOff ? 7 : 14)) * (isOff ? 1 : 0.55);
    for (let h = 1; h <= 6; h++) bass += Math.sin(2 * Math.PI * chord.root * h * t) / h;
    bass *= env * 0.32;
  }

  // Chords: bright saw-ish stack, pumped by the kick (side-chain feel).
  let pad = 0;
  chord.notes.forEach((f, k) => {
    const d = 1 + (k % 2 ? 0.003 : -0.003);
    for (let h = 1; h <= 4; h++) {
      pad += (Math.sin(2 * Math.PI * f * h * t) + Math.sin(2 * Math.PI * f * d * h * t)) / (h * 2);
    }
  });
  const pump = intro ? 0.55 : 1 - 0.75 * Math.exp(-sinceBeat * 9);
  const swell = intro ? Math.min(1, t / (BAR * 2)) : 1;
  pad *= 0.045 * pump * swell;

  // A rising sweep into the drop.
  let riser = 0;
  if (bar === 1) {
    const r = (t - BAR) / BAR;
    riser = high * r * r * 0.25;
  }

  const drums = kick * 0.9 + clap + (intro ? closedHat * 0.5 : closedHat + openHat);
  const outroGain = outro ? Math.max(0, (SECONDS - t) / (BAR * 2)) : 1;
  const mix = (drums + bass + riser) * outroGain;
  L[i] = mix + pad * 1.1 * outroGain;
  R[i] = mix + pad * 0.9 * outroGain;
}

// Normalise to -3 dBFS with a soft clip.
let peak = 0;
for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const scale = 0.9 / peak;
const soft = (x) => Math.tanh(x * 1.2) / Math.tanh(1.2);

const data = Buffer.alloc(total * 4);
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(soft(L[i] * scale) * 0.7 * 32767), i * 4);
  data.writeInt16LE(Math.round(soft(R[i] * scale) * 0.7 * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(new URL('../public/music/bed.wav', import.meta.url), Buffer.concat([header, data]));
console.log(`music/bed.wav (${SECONDS}s at ${BPM} BPM)`);

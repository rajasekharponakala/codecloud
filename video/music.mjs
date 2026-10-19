// Synthesizes the video's soundtrack, so no third-party music is needed: a 112 BPM C–G–Am–F
// progression (pad, plucked bass, light drums) with soft chimes in the same key on every scene
// cut, written as a 48 kHz stereo WAV matching timeline.json. Loudness is normalized later by FFmpeg.
//
//   node video/music.mjs <work-dir>/timeline.json <out.wav>
import fs from 'node:fs';

const [timelineFile, outFile] = process.argv.slice(2);
const timeline = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
const SR = 48_000;
const duration = timeline.duration;
const n = Math.ceil(duration * SR);
const L = new Float32Array(n);
const R = new Float32Array(n);

const BPM = 112;
const beat = 60 / BPM;
const bar = beat * 4;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

// Deterministic noise so every render sounds identical.
let seed = 1;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

function add(start, length, gainL, gainR, fn) {
  const s0 = Math.max(0, Math.floor(start * SR));
  const s1 = Math.min(n, Math.floor((start + length) * SR));
  for (let i = s0; i < s1; i += 1) {
    const v = fn((i - s0) / SR);
    L[i] += v * gainL;
    R[i] += v * gainR;
  }
}

const chords = [
  { bass: 36, pad: [60, 64, 67, 72] }, // C
  { bass: 43, pad: [59, 62, 67, 71] }, // G
  { bass: 45, pad: [57, 60, 64, 69] }, // Am
  { bass: 41, pad: [57, 60, 65, 69] }, // F
];

const outroStart = timeline.scenes.at(-1).start;
const drumsFrom = bar; // first bar under the hook is pad only

for (let b = 0; b * bar < duration; b += 1) {
  const t = b * bar;
  const chord = chords[b % chords.length];

  // Pad: detuned sine pairs with a soft second harmonic, slow attack and release.
  chord.pad.forEach((note, k) => {
    const f = hz(note);
    add(t, bar + 0.4, k % 2 ? 0.75 : 1, k % 2 ? 1 : 0.75, (x) => {
      const env = Math.min(1, x / 0.35) * Math.min(1, Math.max(0, (bar + 0.4 - x) / 0.5));
      const tone = Math.sin(TAU * f * x) + Math.sin(TAU * f * 1.003 * x) + 0.25 * Math.sin(TAU * 2 * f * x);
      return 0.022 * env * tone;
    });
  });

  for (let q = 0; q < 8; q += 1) {
    const at = t + q * (beat / 2);
    if (at >= duration) break;
    const drums = at >= drumsFrom && at < outroStart + bar;

    // Plucked bass on eighths, octave jump on the offbeats.
    const f = hz(chord.bass + (q % 2 ? 12 : 0));
    add(at, 0.4, 1, 1, (x) => 0.11 * Math.exp(-x * 7) * Math.tanh(1.6 * Math.sin(TAU * f * x)));

    if (!drums) continue;
    // Kick on every beat: a sine sweeping 110 → 45 Hz.
    if (q % 2 === 0) {
      add(at, 0.3, 1, 1, (x) => 0.32 * Math.exp(-x * 14) * Math.sin(TAU * (45 * x + (65 / 22) * (1 - Math.exp(-x * 22)))));
    }
    // Soft clap on 2 and 4.
    if (q === 2 || q === 6) add(at, 0.18, 0.9, 1, (x) => 0.07 * Math.exp(-x * 26) * noise());
    // Closed hat on the offbeats, panned slightly right.
    if (q % 2 === 1) {
      let prev = 0;
      add(at, 0.05, 0.6, 1, (x) => {
        const w = noise();
        const hp = w - prev; // crude high-pass
        prev = w;
        return 0.035 * Math.exp(-x * 90) * hp;
      });
    }
  }
}

// Chimes on scene cuts: pentatonic bell tones in C, mixed under the music.
const bells = [84, 88, 91, 93, 96];
timeline.scenes.slice(1).forEach((scene, i) => {
  const f = hz(bells[i % bells.length]);
  add(scene.start - 0.02, 1.4, i % 2 ? 0.8 : 1, i % 2 ? 1 : 0.8, (x) => {
    const env = Math.exp(-x * 3.2) * Math.min(1, x / 0.004);
    return 0.03 * env * (Math.sin(TAU * f * x) + 0.4 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x * 6));
  });
});

// Master: gentle fade in, 2 s fade out, peak-normalize to -1 dBFS.
let peak = 0;
for (let i = 0; i < n; i += 1) {
  const tt = i / SR;
  const fade = Math.min(1, tt / 0.15) * Math.min(1, (duration - tt) / 2);
  L[i] *= fade;
  R[i] *= fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = (10 ** (-1 / 20)) / (peak || 1);

const pcm = Buffer.alloc(44 + n * 4);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + n * 4, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i += 1) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}
fs.writeFileSync(outFile, pcm);
console.log(`wrote ${duration.toFixed(1)}s soundtrack to ${outFile}`);

/**
 * Just enough WAV handling for voice notes: the recognizer writes 16 kHz 16-bit mono PCM
 * (`.wav`), one file per stretch of recording. Pausing starts a new file, so the pieces are
 * joined here, and the clip's waveform bars are worked out from the samples.
 */

type WavInfo = {
  /** Bytes of the `fmt ` chunk body. */
  format: Uint8Array;
  channels: number;
  bitsPerSample: number;
  /** PCM sample data. */
  data: Uint8Array;
};

function ascii(bytes: Uint8Array, at: number, length: number) {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

/** Reads the format and sample data out of a RIFF/WAVE file; null if it isn't one. */
export function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: Uint8Array | null = null;
  let data: Uint8Array | null = null;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = ascii(bytes, at, 4);
    let size = view.getUint32(at + 4, true);
    const body = at + 8;
    // A recorder stopped abruptly can leave the size unset; take the rest of the file.
    if (id === 'data' && (size === 0 || body + size > bytes.length)) size = bytes.length - body;
    if (id === 'fmt ') format = bytes.subarray(body, body + size);
    if (id === 'data') data = bytes.subarray(body, body + size);
    at = body + size + (size % 2);
  }
  if (!format || !data || format.length < 16) return null;
  const fmt = new DataView(format.buffer, format.byteOffset, format.byteLength);
  return {
    format,
    channels: fmt.getUint16(2, true),
    bitsPerSample: fmt.getUint16(14, true),
    data,
  };
}

/**
 * Joins recordings of the same format into one file. Pieces that can't be read, or that differ
 * in format from the first, are left out.
 */
export function joinWavs(files: Uint8Array[]): Uint8Array | null {
  const parsed = files.map(parseWav).filter((w): w is WavInfo => w !== null);
  const first = parsed[0];
  if (!first) return null;
  const same = parsed.filter(
    (w) =>
      w.format.length === first.format.length && w.format.every((b, i) => b === first.format[i]),
  );
  const dataLength = same.reduce((n, w) => n + w.data.length, 0);
  const out = new Uint8Array(12 + 8 + first.format.length + 8 + dataLength);
  const view = new DataView(out.buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, out.length - 8, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, first.format.length, true);
  out.set(first.format, 20);
  let at = 20 + first.format.length;
  write(at, 'data');
  view.setUint32(at + 4, dataLength, true);
  at += 8;
  for (const w of same) {
    out.set(w.data, at);
    at += w.data.length;
  }
  return out;
}

/**
 * Loudness of the recording in `bars` slices, each 0–1 (peak of the slice, on a gentle curve so
 * quiet speech still shows). Empty if the file can't be read.
 */
export function waveformOf(bytes: Uint8Array, bars: number): number[] {
  const wav = parseWav(bytes);
  if (!wav || wav.bitsPerSample !== 16) return [];
  const view = new DataView(wav.data.buffer, wav.data.byteOffset, wav.data.byteLength);
  const frameBytes = 2 * Math.max(1, wav.channels);
  const frames = Math.floor(wav.data.length / frameBytes);
  if (frames === 0) return [];
  const perBar = Math.max(1, Math.floor(frames / bars));
  // Sampling every few frames is plenty for a 32-bar picture.
  const step = Math.max(1, Math.floor(perBar / 200));
  const peaks: number[] = [];
  for (let b = 0; b < bars; b++) {
    let peak = 0;
    const end = Math.min(frames, (b + 1) * perBar);
    for (let f = b * perBar; f < end; f += step) {
      peak = Math.max(peak, Math.abs(view.getInt16(f * frameBytes, true)));
    }
    peaks.push(peak / 32768);
  }
  const loudest = Math.max(...peaks, 0.05);
  return peaks.map((p) => Math.round(Math.sqrt(p / loudest) * 100) / 100);
}

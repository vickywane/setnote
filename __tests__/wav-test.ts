import { joinWavs, parseWav, waveformOf } from '@/lib/wav';

/** A 16 kHz 16-bit mono WAV holding `samples`. */
function wav(samples: number[]) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i);
  };
  write(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, s, true));
  return bytes;
}

describe('parseWav', () => {
  it('reads the format and samples', () => {
    const info = parseWav(wav([1, 2, 3]));
    expect(info).toMatchObject({ channels: 1, bitsPerSample: 16 });
    expect(info?.data.length).toBe(6);
  });

  it('rejects anything that is not a WAV', () => {
    expect(parseWav(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it('takes the rest of the file when the data size was never written', () => {
    const bytes = wav([5, 6]);
    new DataView(bytes.buffer).setUint32(40, 0, true);
    expect(parseWav(bytes)?.data.length).toBe(4);
  });
});

describe('joinWavs', () => {
  it('puts the samples of each piece one after another', () => {
    const joined = joinWavs([wav([1, 2]), wav([3])]);
    const info = joined && parseWav(joined);
    expect(info?.data.length).toBe(6);
    const view = new DataView(info!.data.buffer, info!.data.byteOffset);
    expect([0, 1, 2].map((i) => view.getInt16(i * 2, true))).toEqual([1, 2, 3]);
  });

  it('returns null when nothing can be read', () => {
    expect(joinWavs([new Uint8Array(4)])).toBeNull();
  });
});

describe('waveformOf', () => {
  it('gives one 0–1 level per bar, loudest at 1', () => {
    const samples = [...Array(100).fill(1000), ...Array(100).fill(16000)];
    const bars = waveformOf(wav(samples), 2);
    expect(bars).toHaveLength(2);
    expect(bars[1]).toBe(1);
    expect(bars[0]).toBeGreaterThan(0);
    expect(bars[0]).toBeLessThan(1);
  });

  it('is empty for an unreadable file', () => {
    expect(waveformOf(new Uint8Array(4), 32)).toEqual([]);
  });
});

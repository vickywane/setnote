import {
  comparedWithUsual,
  goodSamples,
  hasReading,
  latest,
  percent,
  summarize,
} from '@/features/recovery/summary';

const sample = (value: number, confidence = 90, stable = true, timestamp = 1) => ({
  value,
  confidence,
  stable,
  timestamp,
});

describe('percent', () => {
  it('reads fractions and percentages alike', () => {
    expect(percent(0.8)).toBe(80);
    expect(percent(80)).toBe(80);
    expect(percent(140)).toBe(100);
    expect(percent(NaN)).toBe(0);
  });
});

describe('goodSamples', () => {
  it('drops low-confidence and invalid samples', () => {
    expect(goodSamples([sample(70, 30), sample(0), sample(NaN), sample(72)])).toEqual([sample(72)]);
  });

  it('prefers stable samples when there are any', () => {
    expect(goodSamples([sample(90, 95, false), sample(72)])).toEqual([sample(72)]);
    expect(goodSamples([sample(90, 95, false)])).toEqual([sample(90, 95, false)]);
  });
});

describe('summarize', () => {
  it('takes the median of each stream so one bad sample cannot skew it', () => {
    const summary = summarize({
      pulse: [sample(100), sample(102), sample(180), sample(101)],
      breathing: [sample(18), sample(20), sample(22)],
      hrv: [],
    });
    expect(summary.pulseBpm).toBe(101.5);
    expect(summary.breathingBpm).toBe(20);
    expect(summary.hrvMs).toBeNull();
    expect(summary.confidence).toBe(90);
    expect(hasReading(summary)).toBe(true);
  });

  it('reports no reading when nothing was confident enough', () => {
    const summary = summarize({ pulse: [sample(80, 10)], breathing: [], hrv: [] });
    expect(summary).toEqual({ pulseBpm: null, breathingBpm: null, hrvMs: null, confidence: null });
    expect(hasReading(summary)).toBe(false);
  });
});

describe('latest', () => {
  it('returns the newest confident value', () => {
    expect(latest([sample(70), sample(75), sample(99, 5)])).toBe(75);
    expect(latest([])).toBeNull();
  });
});

describe('comparedWithUsual', () => {
  it('needs at least three earlier readings', () => {
    expect(comparedWithUsual(100, [90, null, 95])).toBeNull();
  });

  it('compares with the median of earlier readings, within 10%', () => {
    expect(comparedWithUsual(120, [100, 100, 100])).toBe('higher');
    expect(comparedWithUsual(85, [100, 100, 100])).toBe('lower');
    expect(comparedWithUsual(105, [100, 100, 100])).toBe('usual');
    expect(comparedWithUsual(null, [100, 100, 100])).toBeNull();
  });
});

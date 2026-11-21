import type { VitalsSample } from '@/modules/presage-vitals';

/** Below this confidence (0-100) a sample doesn't count toward the result. */
export const MIN_CONFIDENCE = 60;
/** How long a recovery check scans for. */
export const SCAN_MS = 45_000;

export type RecoverySummary = {
  pulseBpm: number | null;
  breathingBpm: number | null;
  hrvMs: number | null;
  /** Mean confidence (0-100) of the samples kept, or null when none were kept. */
  confidence: number | null;
};

/** The SDK's confidence as 0-100, whether it arrives as a fraction or a percentage. */
export function percent(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  const scaled = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(Math.max(scaled, 0), 100);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Samples confident enough to trust: stable ones when there are any, else all that pass. */
export function goodSamples(samples: VitalsSample[]): VitalsSample[] {
  const confident = samples.filter(
    (s) => Number.isFinite(s.value) && s.value > 0 && percent(s.confidence) >= MIN_CONFIDENCE,
  );
  const stable = confident.filter((s) => s.stable);
  return stable.length > 0 ? stable : confident;
}

/** The median of the good samples, so one bad frame can't skew the reading. */
export function summarize(samples: {
  pulse: VitalsSample[];
  breathing: VitalsSample[];
  hrv: VitalsSample[];
}): RecoverySummary {
  const pulse = goodSamples(samples.pulse);
  const breathing = goodSamples(samples.breathing);
  const hrv = goodSamples(samples.hrv);
  const kept = [...pulse, ...breathing, ...hrv];
  return {
    pulseBpm: median(pulse.map((s) => s.value)),
    breathingBpm: median(breathing.map((s) => s.value)),
    hrvMs: median(hrv.map((s) => s.value)),
    confidence:
      kept.length > 0
        ? kept.reduce((sum, s) => sum + percent(s.confidence), 0) / kept.length
        : null,
  };
}

export const hasReading = (summary: RecoverySummary) =>
  summary.pulseBpm !== null || summary.breathingBpm !== null || summary.hrvMs !== null;

/** The latest value of a stream, for the live numbers while scanning. */
export function latest(samples: VitalsSample[]): number | null {
  const good = samples.filter(
    (s) => Number.isFinite(s.value) && s.value > 0 && percent(s.confidence) >= MIN_CONFIDENCE,
  );
  return good.at(-1)?.value ?? null;
}

/**
 * How this reading compares with the person's own earlier ones, in plain words. Never a
 * judgement about health: just higher, lower or about the same as their usual.
 */
export function comparedWithUsual(
  value: number | null,
  previous: (number | null)[],
): 'higher' | 'lower' | 'usual' | null {
  const past = previous.filter((v): v is number => v !== null);
  if (value === null || past.length < 3) return null;
  const usual = median(past)!;
  const diff = (value - usual) / usual;
  if (diff > 0.1) return 'higher';
  if (diff < -0.1) return 'lower';
  return 'usual';
}

export function formatRate(value: number | null): string {
  return value === null ? '–' : String(Math.round(value));
}

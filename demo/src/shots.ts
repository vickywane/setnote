/**
 * The demo's storyboard, in order. Edit the copy and timings here; the voiceover for each scene
 * is in voiceover.json under the scene's id.
 *
 * Phone shots play `public/recordings/<file>` inside a phone frame. Until a recording exists the
 * scene shows a placeholder saying what to film, so the cut can be reviewed early.
 *
 * The consent, scan and results shots come from one real recording on an iPhone with a live
 * SmartSpectra reading (the app never simulates measurements). Sped-up stretches are labelled
 * on screen, so nothing passes for real time that isn't.
 */

/** A stretch of a recording, in seconds of the source file, played at `rate` (default 1). */
export type Segment = { from: number; to: number; rate?: number };

/** A number that counts up beside the phone, e.g. the scan's results. */
export type Stat = { value: number; unit: string; label: string };

export type Shot =
  | {
      kind: 'broll';
      id: string;
      seconds: number;
      file: string;
      trimFrom?: number;
      caption?: string;
      drift?: [number, number];
    }
  | { kind: 'title'; id: string; seconds: number }
  | { kind: 'problem'; id: string; seconds: number; lines: string[] }
  | {
      kind: 'phone';
      id: string;
      seconds: number;
      file: string;
      overline: string;
      title: string;
      body: string;
      /** What to film, shown on the placeholder. */
      record: string;
      /** Marks the shots that show live Presage signals. */
      live?: boolean;
      /**
       * The parts of the recording to play, in order, skipping pauses. Leave out to play the
       * file from the start (cut to the scene's length).
       */
      segments?: Segment[];
      stats?: Stat[];
    }
  | { kind: 'architecture'; id: string; seconds: number }
  | { kind: 'privacy'; id: string; seconds: number }
  | { kind: 'outro'; id: string; seconds: number };

export const SHOTS: Shot[] = [
  {
    kind: 'broll',
    id: 'hook',
    seconds: 5,
    file: 'broll/stock/people-exercising-6740133.mp4',
    trimFrom: 8.5,
    caption: 'THE LAST SET. THE WHOLE STORY.',
  },
  {
    kind: 'phone',
    id: 'log-sets',
    seconds: 12,
    file: 'log-sets.mp4',
    overline: 'LOG SETS',
    title: 'Two taps a set',
    body: 'Prefilled from your last set. The rest timer starts the moment you log.',
    record: 'Start a session, add Squat, log two sets with the steppers, let the rest timer run.',
    // Recorded on the simulator: steppers, set 1, rest timer, set 2.
    segments: [
      { from: 0, to: 5.5, rate: 1.4 },
      { from: 9, to: 12.5, rate: 1.2 },
      { from: 15.5, to: 21.5, rate: 1.3 },
    ],
  },
  {
    kind: 'phone',
    id: 'write-it-down',
    seconds: 12,
    file: 'write-it-down.mp4',
    overline: 'WRITE IT DOWN',
    title: 'Scribble it. Logged.',
    body: 'Write it like your notebook. Setnote reads the numbers and logs the sets in one tap.',
    record:
      'Open the exercise note, type "80kg 8, 8, 6 felt easy", open Picked up, tap "Log 3 sets".',
    // Add Deadlift, write the note, Picked up → "Log 3 sets", back to the session.
    segments: [
      { from: 7, to: 10, rate: 1.3 },
      { from: 17.6, to: 19.6, rate: 1.5 },
      { from: 23.4, to: 26, rate: 1.3 },
      { from: 32.4, to: 37.6, rate: 1.6 },
      { from: 38.2, to: 43.6, rate: 1.2 },
      { from: 46, to: 50.5 },
    ],
  },
  {
    kind: 'phone',
    id: 'consent',
    seconds: 6,
    file: 'presage.mp4',
    overline: 'HOW DO YOU FEEL?',
    title: 'Check in after the set',
    body: 'One tap from the exercise. It explains the 45-second check and waits for you to start it.',
    record: 'Tap "How do you feel?", show the explanation, tap Start.',
    live: true,
    // Real iPhone: the session, "How do you feel?", the explanation, Start, the check begins.
    segments: [
      { from: 1.6, to: 6.6 },
      { from: 6.6, to: 12, rate: 1.5 },
    ],
  },
  {
    kind: 'phone',
    id: 'scan',
    seconds: 16,
    file: 'presage.mp4',
    overline: 'PRESAGE SMARTSPECTRA · LIVE',
    title: 'Your camera is the sensor',
    body: 'Pulse and breathing, read live on the phone. No strap. No watch. No wearable.',
    record: 'On a physical iPhone: the 45-second check with live readings.',
    live: true,
    // The 45-second check: the warm-up sped up, then real time as pulse and breathing appear.
    segments: [
      { from: 12, to: 32.6, rate: 6 },
      { from: 32.6, to: 36.2 },
      { from: 36.2, to: 41.2, rate: 3 },
      { from: 41.2, to: 44.4 },
      { from: 44.4, to: 51.4, rate: 2.5 },
    ],
  },
  {
    kind: 'phone',
    id: 'results',
    seconds: 6,
    file: 'presage.mp4',
    overline: 'SAVED WITH THE SET',
    title: 'See what each set costs',
    body: 'Readings sit next to the exercise, compared with your own earlier checks.',
    record: 'The results screen, Save with exercise, back to the session.',
    live: true,
    // Ends on the session with its new pulse pill, before Control Center comes down.
    segments: [{ from: 51.4, to: 54.1 }],
  },
  { kind: 'architecture', id: 'architecture', seconds: 8 },
  { kind: 'privacy', id: 'privacy', seconds: 10 },
  { kind: 'outro', id: 'outro', seconds: 5 },
];

export const recordingFiles = [
  ...new Set(SHOTS.flatMap((s) => (s.kind === 'phone' ? [s.file] : []))),
];

/** Seconds a list of segments takes to play. */
export const segmentsSeconds = (segments: Segment[]) =>
  segments.reduce((sum, s) => sum + (s.to - s.from) / (s.rate ?? 1), 0);

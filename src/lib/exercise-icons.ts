/**
 * Exercise icons exported from the Figma "Exercise icons" library (24 grid, 1.75 stroke).
 * `iconForExercise` maps an exercise name (catalog or user-typed) to the right icon and
 * falls back to the generic dumbbell for anything it doesn't recognise.
 */
export const EXERCISE_ICONS = {
  'bench-press': require('../../assets/icons/exercises/bench-press.svg'),
  'incline-bench-press': require('../../assets/icons/exercises/incline-bench-press.svg'),
  'dumbbell-fly': require('../../assets/icons/exercises/dumbbell-fly.svg'),
  'push-up': require('../../assets/icons/exercises/push-up.svg'),
  dip: require('../../assets/icons/exercises/dip.svg'),
  deadlift: require('../../assets/icons/exercises/deadlift.svg'),
  'pull-up': require('../../assets/icons/exercises/pull-up.svg'),
  'lat-pulldown': require('../../assets/icons/exercises/lat-pulldown.svg'),
  'barbell-row': require('../../assets/icons/exercises/barbell-row.svg'),
  'seated-cable-row': require('../../assets/icons/exercises/seated-cable-row.svg'),
  'overhead-press': require('../../assets/icons/exercises/overhead-press.svg'),
  'lateral-raise': require('../../assets/icons/exercises/lateral-raise.svg'),
  'face-pull': require('../../assets/icons/exercises/face-pull.svg'),
  'bicep-curl': require('../../assets/icons/exercises/bicep-curl.svg'),
  'hammer-curl': require('../../assets/icons/exercises/hammer-curl.svg'),
  'tricep-pushdown': require('../../assets/icons/exercises/tricep-pushdown.svg'),
  'skull-crusher': require('../../assets/icons/exercises/skull-crusher.svg'),
  squat: require('../../assets/icons/exercises/squat.svg'),
  'leg-press': require('../../assets/icons/exercises/leg-press.svg'),
  'romanian-deadlift': require('../../assets/icons/exercises/romanian-deadlift.svg'),
  lunge: require('../../assets/icons/exercises/lunge.svg'),
  'leg-extension': require('../../assets/icons/exercises/leg-extension.svg'),
  'leg-curl': require('../../assets/icons/exercises/leg-curl.svg'),
  'hip-thrust': require('../../assets/icons/exercises/hip-thrust.svg'),
  'calf-raise': require('../../assets/icons/exercises/calf-raise.svg'),
  custom: require('../../assets/icons/exercises/custom.svg'),
} as const;

export type ExerciseIconKey = keyof typeof EXERCISE_ICONS;

// Order matters: more specific names first ("hammer curl" before "curl").
const RULES: [RegExp, ExerciseIconKey][] = [
  [/hammer curl/, 'hammer-curl'],
  [/leg curl|hamstring curl/, 'leg-curl'],
  [/curl/, 'bicep-curl'],
  [/incline bench/, 'incline-bench-press'],
  [/bench/, 'bench-press'],
  [/romanian|\brdl/, 'romanian-deadlift'],
  [/deadlift/, 'deadlift'],
  [/lat pull|pulldown/, 'lat-pulldown'],
  [/pull-?up|chin-?up/, 'pull-up'],
  [/calf/, 'calf-raise'],
  [/leg press/, 'leg-press'],
  [/leg extension/, 'leg-extension'],
  [/lunge|split squat/, 'lunge'],
  [/squat/, 'squat'],
  [/hip thrust|glute bridge/, 'hip-thrust'],
  [/overhead press|\bohp\b|shoulder press|military press/, 'overhead-press'],
  [/lateral raise/, 'lateral-raise'],
  [/face pull/, 'face-pull'],
  [/cable row|seated row/, 'seated-cable-row'],
  [/\brow\b/, 'barbell-row'],
  [/pushdown|push down/, 'tricep-pushdown'],
  [/skull/, 'skull-crusher'],
  [/\bfly|flye/, 'dumbbell-fly'],
  [/push-?up/, 'push-up'],
  [/\bdips?\b/, 'dip'],
];

export function iconForExercise(name: string): ExerciseIconKey {
  const lower = name.toLowerCase();
  return RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? 'custom';
}

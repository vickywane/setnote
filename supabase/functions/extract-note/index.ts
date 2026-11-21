// Reads a free-text gym note with Claude and returns the exercises in it, in the same shape
// as the app's on-device parser (src/lib/extraction/parse-note.ts). The app shows its own
// parse straight away and swaps in this one when it arrives; the app also checks the result
// against the catalog and works out what's missing, so this function only reads the note.
//
// POST { text: string, catalog: { id, name, aliases, equipment }[] }
//   -> 200 { exercises: ModelExercise[] }
// Needs a signed-in (or guest) Supabase user, and the ANTHROPIC_API_KEY secret.

import Anthropic from 'npm:@anthropic-ai/sdk@1.10.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const MODEL = 'claude-opus-5-5';
const MAX_TEXT = 8000;
const MAX_CATALOG = 500;

const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'kettlebell',
  'band',
  'bodyweight',
  'smith_machine',
  'other',
] as const;

type CatalogEntry = { id: string; name: string; aliases: string[]; equipment: string[] };

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

/** What Claude returns for each exercise in the note. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['exercises'],
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'catalogId',
          'sourceText',
          'equipment',
          'weight',
          'sets',
          'reps',
          'setChanges',
          'effort',
          'goal',
          'bodyNotes',
        ],
        properties: {
          name: { type: 'string' },
          catalogId: nullable({ type: 'string' }),
          sourceText: { type: 'string' },
          equipment: nullable({ type: 'string', enum: [...EQUIPMENT] }),
          weight: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['value', 'unit'],
            properties: { value: { type: 'number' }, unit: { type: 'string', enum: ['kg', 'lb'] } },
          }),
          sets: nullable({ type: 'integer' }),
          reps: { type: 'array', items: { type: 'integer' } },
          setChanges: { type: 'array', items: { type: 'string' } },
          effort: nullable({ type: 'string', enum: ['low', 'medium', 'high'] }),
          goal: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['text', 'targetReps'],
            properties: { text: { type: 'string' }, targetReps: nullable({ type: 'integer' }) },
          }),
          bodyNotes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

const SYSTEM = `You read gym notes that people write during or after a workout and pull out the exercises they did, for a workout log. Notes are informal: shorthand, typos, ellipses, run-on sentences, several exercises in one note.

For each exercise the note describes, in the order written:
- name: the catalog name when it matches one (by name, alias or obvious meaning: "arm curl" or "db curls" is a bicep curl), else the exercise as the person wrote it, in sentence case.
- catalogId: the matching catalog id, or null if no catalog exercise matches. Never invent an id.
- sourceText: the exact part of the note this exercise was read from, copied verbatim.
- equipment: only if the note says or clearly implies it ("DB" = dumbbell, "BB" = barbell, "smith" = smith_machine, pull-ups with no weight = bodyweight). Otherwise null; don't assume the catalog's usual equipment.
- weight: the working weight and its unit as written ("32kg" -> 32 kg). null if not stated. Don't convert units.
- reps: reps per set in order, as performed. "32kg… 10" means sets of 10; "3x8" means [8, 8, 8]; "8, 8, 6" means [8, 8, 6]. If only one rep count is given with a set count, repeat it per set. Empty if not stated.
- sets: the number of sets if stated or clear from reps, else null.
- setChanges: only when the note says in words that a set was done differently, e.g. "had to break into 5 reps per go after 3 sets" -> "Clusters of 5 reps after set 3", or "dropped the weight on the last one" -> "Drop set on the last set". Rep counts alone are never a set change: "8, 8, 6" is just reps. Empty otherwise.
- effort: "high" if it was hard (struggled, grind, RPE 8+), "medium" for OK/solid (RPE 6-7), "low" if easy, else null.
- goal: only when the note states what they want to do next time ("should be able to drive it to 10 reps per set", "go up to 35kg next week"), as a short sentence in their words, with targetReps if they name a rep target per set. Never infer a goal from the numbers. null if none.
- bodyNotes: pain, tightness or injuries they mention, as short phrases. Report them only; give no advice.

Rules: read only what's written; leave a field empty or null rather than guess. Many people only write numbers ("Bench 80kg 8, 8, 6"); for those, setChanges, goal and bodyNotes stay empty and effort is null unless an RPE is given. Don't list an exercise that's only mentioned as a future plan with nothing performed. If the note has no exercises, return an empty list.`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function readBody(body: unknown): { text: string; catalog: CatalogEntry[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const { text, catalog } = body as { text?: unknown; catalog?: unknown };
  if (typeof text !== 'string' || !Array.isArray(catalog)) return null;
  const entries = catalog
    .filter(
      (e): e is CatalogEntry =>
        typeof e?.id === 'string' && typeof e?.name === 'string' && Array.isArray(e?.aliases),
    )
    .slice(0, MAX_CATALOG)
    .map((e) => ({
      id: e.id,
      name: e.name,
      aliases: e.aliases.filter((a) => typeof a === 'string').slice(0, 20),
      equipment: Array.isArray(e.equipment) ? e.equipment.filter((q) => typeof q === 'string') : [],
    }));
  return { text: text.slice(0, MAX_TEXT), catalog: entries };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Only the app's own users: a signed-in or guest Supabase session.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Sign in first' }, 401);

  const input = readBody(await req.json().catch(() => null));
  if (!input) return json({ error: 'Expected { text, catalog }' }, 400);
  if (!input.text.trim()) return json({ exercises: [] });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Note reading isn’t set up' }, 503);
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });

  const catalogLines = input.catalog
    .map((e) => `${e.id} | ${e.name} | ${e.aliases.join(', ')} | ${e.equipment.join(', ')}`)
    .join('\n');

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A refused request is retried on a fallback model chosen by the API.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Reading a short note doesn't need deep reasoning.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Exercise catalog (id | name | aliases | equipment):\n${catalogLines}\n\n<note>\n${input.text}\n</note>`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') return json({ error: 'Couldn’t read this note' }, 422);
    if (response.stop_reason === 'max_tokens') return json({ error: 'Note too long' }, 422);
    const text = [...response.content].reverse().find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'No result' }, 502);
    const parsed = JSON.parse(text.text) as { exercises: unknown[] };
    const known = new Set(input.catalog.map((e) => e.id));
    const exercises = parsed.exercises.map((e) => {
      const exercise = e as { catalogId: string | null };
      // Only ids from this user's catalog.
      return { ...exercise, catalogId: exercise.catalogId && known.has(exercise.catalogId) ? exercise.catalogId : null };
    });
    return json({ exercises });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Busy, try again' }, 429);
    if (error instanceof Anthropic.APIError) {
      return json({ error: `Note reading failed (${error.status ?? 'network'})` }, 502);
    }
    if (error instanceof SyntaxError) return json({ error: 'Unreadable result' }, 502);
    throw error;
  }
});

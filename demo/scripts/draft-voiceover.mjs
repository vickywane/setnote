// Draft voiceover with the macOS `say` voice, one file per scene, from src/voiceover.json.
// Replace public/voiceover/<scene>.wav with better recordings (ElevenLabs, your own voice)
// using the same file names; the video picks up their lengths automatically.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const voice = process.env.VOICE ?? 'Samantha';
const rate = process.env.RATE ?? '172';
const lines = JSON.parse(readFileSync(new URL('../src/voiceover.json', import.meta.url), 'utf8'));
const out = new URL('../public/voiceover/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

for (const [id, text] of Object.entries(lines)) {
  const aiff = join(out, `${id}.aiff`);
  const wav = join(out, `${id}.wav`);
  execFileSync('say', ['-v', voice, '-r', rate, '-o', aiff, text]);
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@44100', aiff, wav]);
  rmSync(aiff);
  console.log(`voiceover/${id}.wav`);
}

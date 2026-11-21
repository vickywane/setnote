# Brief: produce the final Setnote demo video

You are producing the final demo video for **Setnote**, an iPhone training journal entered in the **Presage SmartSpectra SDK Challenge** on DEV. Everything you need is in this repository. Work in `demo/`, a Remotion 4.0.545 project that is separate from the Expo app. Read this brief fully before you start, then work through it in order.

**The deliverable:** `demo/out/setnote-demo-final-1080p.mp4`, 1920×1080, 30 fps, H.264 with AAC audio, about 90–120 seconds, ready to upload to YouTube and embed in the DEV post.

**Deadline:** submissions close **22 November, 11:59 PM PST**. Leave the user time to upload the video and publish the post.

---

## 1. Decisions to confirm with the user before you generate anything

Ask these in one message, each with the default shown, and wait for answers. Each option costs differently.

1. **Music track.** Four ElevenLabs tracks are in `demo/public/music/options/`: `1-electronic.mp3` (128 BPM, 120 s), `2-trap.mp3`, `3-rock.mp3` and `4-cinematic.mp3` (each 100 s). Mixes with the current voiceover are in `demo/out/music-mixes/`. **Default:** `1-electronic.mp3`, which leaves the most room for the voices. The user rejected the old procedurally generated `music/bed.m4a`: don't use it.
2. **The lifter's voice (second voice).** Either (a) the user records the six LIFTER lines on their phone, which is free, uses their real voice (they are the person in the device recording) and is the default, or (b) ElevenLabs voice **Miles** (`vSjOBQp24DUB2COr2xI9`).
3. **Gym scenes with people.** Either (a) free stock video from Pexels or Pixabay, which allow free commercial use; the user downloads it, or you download it only with their explicit OK, naming the file and source. Real moving footage is the default. Or (b) more AI stills from ElevenLabs, animated in Remotion. One already exists: `demo/public/broll/gym-wide.png`.
4. **ElevenLabs credits.** The account had **309 credits left** of its 10,000 quota. One image set costs about 818 credits, music about 900, and a voice line about 50–200. **Video generation is not available on the user's plan.** If ElevenLabs is needed, ask the user to top up first.

## 2. What the user asked for

These are the user's change requests, gathered across the review.

- **Two voices:** a **NARRATOR** (Sia) and a **LIFTER** who speaks in the first person mid-workout.
- **Gym and fitness scenes with people, several in shot**, not only app screens.
- **The value of the app and the value of SmartSpectra**, both clearly shown and said.
- **More energy:** enthusiastic delivery, an energetic gym soundtrack, adrenaline. The user disliked the earlier background track.
- **The device recording cut to the essentials** (consent, live scan, results), with dead time removed and sped up.
- **A short, high-level architecture diagram.** Include it, but don't make it the focus.
- **The privacy line must say "by default":** "By default, your video never leaves the phone…". This line must be re-recorded before the final render. The current `demo/public/voiceover/privacy.wav` does **not** say it.

## 3. What judges look for

**Criteria:** use of the underlying technology, usability and UX, and originality.

**Rules:**
- Judges check the **repo and the video** for the SmartSpectra integration and **at least one live Presage signal**.
- The submission needs a consent and data-handling section.
- Diagnosis or treatment claims, medical decision-making, and covert monitoring are banned.

**What other entries do** (8 entries reviewed):
- Only 2 of 8 narrate their video, and only 2 show an architecture diagram.
- Almost none show the full path from consent to live signal to result.
- The strongest entries label sped-up or illustrative footage honestly and show the real time it takes to get a first reading.
- The weakest entries never show a live reading.

The video should beat all of these.

## 4. Honesty rules (non-negotiable)

- **Every vital number on screen comes from the real device recording** (`presage.mp4`). Never generate, fake or animate readings onto AI or stock footage. B-roll must never show a phone screen with readings.
- **Label sped-up footage:** the existing `SpeedBadge` shows "6× SPEED" and similar on any segment with rate ≥ 2. Label AI or stock B-roll "Illustrative": the existing `BRoll` component does this.
- **No medical, diagnostic or readiness claims.** Say "wellness", "how hard the set hit you" and "see patterns". Never say "recovered", "safe to lift" or "clinical".
- **HRV showed "–" in the recording**, so only say "pulse and breathing". Don't promise HRV.
- **Data facts must match the app:**
  - The SDK processes on the phone and never sends video.
  - SDK telemetry is off (`enableTelemetry = false`).
  - The SDK only contacts Presage for licence validation.
  - Only the numbers (pulse, breathing, and HRV when available) are saved, in Supabase with row-level security.
  - **"Save check videos" is an opt-in, off by default.** When it's on, videos are kept privately in the account, or on the phone for guests.
  - Readings are deleted with the exercise, the session or the account.
  - The check is for general wellness and is not a medical device.

## 5. The script

Start from `demo/script-two-voices.md`, a 16-line, two-voice script. It's the user's approved direction, but keep tightening the wording for energy. Keep the beat order:

hook (B-roll) → problem (B-roll) → title/music drop → **app value** (log sets, write it down) → check-in (B-roll) → consent (device) → **SmartSpectra value** (live scan: "your front camera becomes a vitals sensor… no strap, no watch, nothing to charge") → results (device + count-up) → value payoff (B-roll) → architecture → privacy ("by default") → outro.

**Voice production:**
- **NARRATOR:** ElevenLabs **Sia**, `voice_id qTRV75fy2dUja4REMifv`, model `eleven_v4`. Prefix prompts with `[energetic]`, or `[confident]` for the architecture and privacy lines.
- **LIFTER:** per decision 2.
- Use the existing ElevenLabs flow `qo4vHob5po2Pq7VLul62`, so all takes stay together on the user's canvas.
- Save each line as `demo/public/voiceover/<scene-id>.wav` (mono, 44.1 kHz): `npx remotion ffmpeg -i in.mp3 -ar 44100 -ac 1 out.wav`. Keep the source MP3s in `demo/raw/`, which is gitignored.
- Keep `demo/src/voiceover.json` in sync with what's actually spoken.
- **ElevenLabs gotchas:**
  - "Free generations are busy" errors are common. Nothing is charged, but the tool forbids retrying in the same turn: report it and retry next turn.
  - `generations_count` defaults to 2 for speech. Use the first take unless it's flawed.
  - Signed download URLs expire, so download right after completion.
- **User recordings:** if the user records the LIFTER lines, ask for one file per line. Convert them as above, trim the silence at both ends, and level them to match Sia (around −16 LUFS; adjust the volume in Remotion if the tools here can't measure loudness).

## 6. Assets already in place

| Path | What it is | Notes |
|---|---|---|
| `demo/public/recordings/log-sets.mp4` | Simulator: steppers, set 1, rest timer, set 2 | Segments in `shots.ts` |
| `demo/public/recordings/write-it-down.mp4` | Simulator: add Deadlift, type note, Picked up → "Log 3 sets", back to session | Segments in `shots.ts` |
| `demo/public/recordings/presage.mp4` | **Real iPhone, live SmartSpectra**, converted to H.264 720 px wide, 30 fps, no audio | See timings below |
| `demo/public/broll/gym-wide.png` | AI still, busy gym with 5 people, 2048×1152 | Use with `BRoll` |
| `demo/public/music/options/*.mp3` | 4 ElevenLabs music candidates | Per decision 1 |
| `demo/public/voiceover/*.wav` | Current Sia lines from the previous single-voice script | Reuse only where the wording still matches |
| `../presage_live_recording.MP4` | Original HEVC device recording, 55.6 s, 1320×2868 | Source of `presage.mp4` |

**Timings in `presage.mp4`** (seconds):
- 1.6–6.6: the session, tapping "How do you feel?", the explanation screen, tapping Start.
- 6.6–12: the camera starts and the 45-second check begins.
- 12–32.6: warm-up with no readings yet. Speed up about 6×, labelled.
- **32.6–36.2: first pulse appears (92 bpm). Real time.**
- 36.2–41.2: speed up about 3×.
- **41.2–44.4: breathing appears (23/min). Real time.**
- 44.4–51.4: pulse settles to 77. About 2.5×.
- 51.4–54.1: the results screen (77 bpm, 23/min), Save with exercise, then back to the session with a "Pulse 77 · 23 breaths/min" pill.
- **iOS Control Center slides down at about 54.3 s. Never use footage after 54.1 s**, including in the last-frame hold (`Freeze` uses `segment.to`).

## 7. How the Remotion project works

- `src/shots.ts` is the storyboard. Scene kinds: `title`, `problem`, `phone` (recording in a phone frame, with optional `segments` (`from`, `to`, `rate`), `live` and `stats`), `architecture`, `privacy` and `outro`. Add new kinds as needed, for example `broll` using `scenes/BRoll.tsx`, and a two-voice scene type.
- `src/timeline.ts` sets each scene's length to the larger of its footage and its voiceover plus a lead-in and tail. For two voices in one scene, extend this so a scene can hold several voice clips in sequence, each with its own offset, with total length = the sum of the clips plus their gaps.
- `src/SetnoteDemo.tsx` handles the transitions (slide into phone shots, fade elsewhere, 9 frames), the per-scene voiceover `<Audio>`, and music ducking. Its `music` and `musicVolume` props set the track and its level; the music drops to 35% of its level under speech. Ducking should cover every voice clip from both voices.
- `src/Root.tsx`: `calculateMetadata` probes which recordings and voiceover files exist (HEAD requests; the 404s in the render log are expected) and measures voiceover lengths with `@remotion/media-parser`. The `BRollPreview` composition is a test piece.
- **Scenes:**
  - `PhoneShot` (phone frame, `SpeedBadge`, count-up `Stats`, placeholder when a file is missing).
  - `ArchitectureCard`: camera → SmartSpectra SDK → PresageVitals Expo module → Setnote app → Supabase, with a dashed "on the phone" boundary. It's checked against `modules/presage-vitals`.
  - `PrivacyCard`: its on-screen text already matches the opt-in.
  - `TitleCard`, `ProblemCard` and `Outro`. `Outro` shows `repoUrl` if passed as a prop.
- The theme in `src/theme.ts` uses the app's palette and fonts: Newsreader, Geist and Geist Mono via `@remotion/google-fonts`.

**Commands** (run them from `demo/`):
- Preview: `npm run studio`.
- Typecheck: `npx tsc --noEmit`.
- Final render: `npx remotion render SetnoteDemo out/setnote-demo-final-1080p.mp4 --props='{"repoUrl":"github.com/<user>/setnote","music":"music/options/<pick>.mp3","musicVolume":0.28}'`.

Ask the user for the repo URL, or omit `repoUrl` and the outro hides it.

**Known gotchas:**
- Renders occasionally fail with a frame-seek timeout. Retry once.
- Remotion's bundled `ffmpeg` lacks the `fps`, `tile` and `hstack` filters. Use `-r 1` to pull frames, and `-f mp4` to write `.m4a` files.
- The shell is zsh, where `rm out/*.png` fails when nothing matches and stops a `&&` chain. Use `rm -f` with care, or `find … -delete`.
- iPhone recordings are HEVC. Convert any new clip: `npx remotion ffmpeg -i in.MOV -vf scale=720:-2 -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p -an out.mp4`.
- `xcrun simctl io booted recordVideo` takes up to 30 seconds to start. Wait for "Recording started" before acting. It skips identical frames, and keystrokes sent with nothing focused trigger dev-client shortcuts ("d" opens the dev menu, "i" toggles the inspector). Hide the dev client's floating Tools button first (dev menu › Tools button).

## 8. Creative direction

- **Pace:** quick cuts, with no shot held without a reason. The scan's real-time moments, when the readings appear, are the hero. Let them breathe and put the speed-ups around them.
- **Open on people:** the first three beats are B-roll of a busy gym and a lifter after a hard set. Cut on the music's beat where you can; the electronic track is 128 BPM, so one bar is about 1.875 s.
- **Two clear beats of value:**
  - **App value:** two-tap logging, notes that log themselves, readings sitting next to each set, offline-friendly.
  - **SmartSpectra value:** vitals from the camera you already carry, no wearable, on the device, privacy-first.
  - Give each a short on-screen caption, for example "2 taps per set" and "No strap. No watch.", so the point lands with the sound off.
- **Ken Burns on stills:** a slow push-in of 1.04 → 1.16 with a slight drift, a vignette, and the "Illustrative" tag. Vary the direction from shot to shot.
- **Architecture:** 6–9 seconds, no more.
- **End card:** the Setnote wordmark, the repo URL, and `#presagechallenge`.

## 9. Check before you hand over

1. `npx tsc --noEmit` passes.
2. Probe the final file: 1920×1080, it has an audio stream, and the duration is about 90–120 s.
3. Pull a frame at least every 3 seconds (`npx remotion ffmpeg -ss <t> -i out/… -frames:v 1 out/check-<t>.png`) and look at every one. Check for:
   - no Control Center, dev menu, element inspector or placeholder ("TO RECORD") frames;
   - no overlapping text;
   - speed badges on every sped-up stretch;
   - "Illustrative" on every B-roll shot;
   - the architecture diagram readable.
4. Listen to the whole video. Check for:
   - every line present, with no clipping or overlap;
   - the music audible but ducked under both voices;
   - the privacy line saying **"by default"**;
   - no line claiming HRV, recovery or anything medical.
5. Check that `demo/src/voiceover.json` and the script match what's spoken.
6. Update `demo/README.md` (assets table, the voices used, the music used), and mark the reminder about the "by default" privacy line as done.

## 10. Hand-over to the user

Give the user:
- the path to the final MP4;
- the running time;
- the credits spent;
- which assets are AI-generated, stock or real, to disclose in the DEV post;
- anything you couldn't do.

The DEV post draft is in `submission/dev-post.md`. Update its **Demo** section if the video's contents changed: mention the illustrative B-roll and the two voices. The YouTube link and repo URL placeholders are the user's to fill in.

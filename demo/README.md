# Setnote demo video

The product demo for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04), made with [Remotion](https://www.remotion.dev). It is separate from the Expo app and has its own `package.json`.

```sh
cd demo
npm install
npm run studio
npx remotion render SetnoteDemo out/setnote-demo-final-1080p.mp4 --props='{"music":"music/options/1-electronic.mp3","musicVolume":0.16}'
```

The storyboard lives in `src/shots.ts`; the narration text is in `src/voiceover.json` and `script-two-voices.md`. All spoken audio now uses the existing ElevenLabs Sia takes; the local manual takes have been removed. The ElevenLabs MP3 sources remain in `raw/eleven-sia/`; the project copies are mono 44.1 kHz WAVs in `public/voiceover/`. No new credits were used. Electronic track 1 plays quietly throughout, ducking under narration and rising slightly in the gaps.

## Final cut assets

| File | Source | Use |
|---|---|---|
| `public/recordings/log-sets.mp4` | Simulator | Set logging and rest timer |
| `public/recordings/write-it-down.mp4` | Simulator | Note parsing and “Log 3 sets” |
| `public/recordings/presage.mp4` | Supplied physical iPhone recording | Consent, real SmartSpectra scan and results |
| `public/broll/stock/people-exercising-6740133.mp4` | Mikhail Nilov, Pexels | Single illustrative opening gym scene |
| `public/music/options/1-electronic.mp3` | Existing ElevenLabs-generated track 1 | Quiet full-length bed with voice ducking |

Pexels footage is identified in the video as **Illustrative · Stock**. The optional `BRollPreview` composition still uses `public/broll/gym-wide.png`; that AI still does not appear in the final cut.

## Recording and privacy notes

- The real phone clip is trimmed to end at 54.1 seconds, before iOS Control Center appears.
- The scan warm-up is sped up and marked with speed badges. The first pulse (92 bpm) and breathing value (23/min) appear in real time; the result screen shows 77 bpm and 23/min. The video does not invent readings or show HRV.
- The spoken privacy line says “By default”. Saving check videos is optional and off by default; SmartSpectra processes video on-device, while only readings sync by default.
- The privacy card covers consent, on-device processing, opt-in video storage, deletion, telemetry and licence validation. The wellness disclaimer appears once in the actual phone recording.
- **Done:** re-recorded the privacy line with “By default” and updated the on-screen data details.

## Review and output

Preview in Remotion Studio with `npm run studio`. The final render is 1920×1080 at 30 fps, H.264 video with AAC audio, ready for YouTube and the DEV post. The DEV post draft is `../submission/dev-post.md`.

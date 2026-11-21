#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEMO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$DEMO_DIR"
VOICE_DIR="$DEMO_DIR/public/voiceover"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# On-device macOS voices: no external TTS service or ElevenLabs credits.
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/hook.aiff" -- 'Last set. That one felt brutal.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/problem.aiff" -- 'Your log gets the weight, the reps, the sets. But not what that effort felt like.'
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/question.aiff" -- 'Was that a tough set? Or am I just tired?'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/title.aiff" -- 'Meet Setnote. A training log that listens as well as it counts.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/log-sets.aiff" -- 'Two taps. Your last set is ready to go, and your rest timer starts the moment you log.'
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/write-lifter.aiff" -- 'Honestly? I just scribble my sets.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/write-narrator.aiff" -- 'Then scribble. Setnote reads the note and turns weight, sets and reps into a log with one tap.'
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/check-in.aiff" -- 'Okay. How hard did that actually hit me?'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/consent.aiff" -- 'Setnote explains the check, and the camera waits until you tap Start. Every time.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/scan.aiff" -- 'Presage SmartSpectra turns the front camera into a vitals sensor. It reads pulse and breathing live, on the phone. No strap. No watch. Nothing to charge.'
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/results.aiff" -- 'Pulse seventy-seven. Breathing twenty-three. Saved right here, beside the set.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/value.aiff" -- 'Now my log tells me what I did, and gives me a new way to spot my own patterns over time.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/architecture.aiff" -- 'SmartSpectra runs on-device through a native Expo module. Only readings sync to Setnote in Supabase.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/privacy.aiff" -- 'By default, your check video is not sent off the phone or saved. If you opt in, videos are private to your account; as a guest, they stay on your phone. Presage processes video on-device; only readings sync. Telemetry is off. Wellness, not a medical device.'
say -v 'Eddy (English (US))' -r 176 -o "$TMP_DIR/outro-lifter.aiff" -- 'Lift heavy.'
say -v 'Samantha (English (US))' -r 172 -o "$TMP_DIR/outro-narrator.aiff" -- 'Listen to your body. Setnote.'

for id in hook problem question title log-sets write-lifter write-narrator check-in consent scan results value architecture privacy outro-lifter outro-narrator; do
  afconvert -f WAVE -d LEI16@44100 "$TMP_DIR/$id.aiff" "$TMP_DIR/$id.wav"
done

cp "$TMP_DIR/hook.wav" "$VOICE_DIR/hook.wav"
cp "$TMP_DIR/problem.wav" "$VOICE_DIR/problem.wav"
cp "$TMP_DIR/question.wav" "$VOICE_DIR/question.wav"
cp "$TMP_DIR/title.wav" "$VOICE_DIR/title.wav"
cp "$TMP_DIR/log-sets.wav" "$VOICE_DIR/log-sets.wav"
cp "$TMP_DIR/check-in.wav" "$VOICE_DIR/check-in.wav"
cp "$TMP_DIR/consent.wav" "$VOICE_DIR/consent.wav"
cp "$TMP_DIR/scan.wav" "$VOICE_DIR/scan.wav"
cp "$TMP_DIR/results.wav" "$VOICE_DIR/results.wav"
cp "$TMP_DIR/value.wav" "$VOICE_DIR/value.wav"
cp "$TMP_DIR/architecture.wav" "$VOICE_DIR/architecture.wav"
cp "$TMP_DIR/privacy.wav" "$VOICE_DIR/privacy.wav"

python3 - "$TMP_DIR" "$VOICE_DIR" <<'PY'
import sys
import wave
from pathlib import Path

tmp = Path(sys.argv[1])
out = Path(sys.argv[2])

def combine(parts, destination):
    with wave.open(str(tmp / parts[0]), 'rb') as first:
        params = first.getparams()
        frames = [first.readframes(first.getnframes())]
    silence = b'\0\0' * int(params.framerate * 0.28)
    for part in parts[1:]:
        with wave.open(str(tmp / part), 'rb') as voice:
            if voice.getparams()[:3] != params[:3]:
                raise ValueError(f'Incompatible audio format: {part}')
            frames.extend((silence, voice.readframes(voice.getnframes())))
    with wave.open(str(out / destination), 'wb') as combined:
        combined.setparams(params)
        combined.writeframes(b''.join(frames))

combine(['write-lifter.wav', 'write-narrator.wav'], 'write-it-down.wav')
combine(['outro-lifter.wav', 'outro-narrator.wav'], 'outro.wav')
PY

echo 'Generated 14 scene voiceovers with local macOS voices.'

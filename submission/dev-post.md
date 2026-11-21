---
title: "Setnote: a gym log that reads how hard each set hit you, with your phone's camera"
published: false
tags: devchallenge, presagechallenge, presage, reactnative
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

## What I Built

Setnote is a training journal that uses Presage SmartSpectra to read how hard each set hit you, through the phone's front camera. After a set, tap **How do you feel?** and hold the phone up for 45 seconds. SmartSpectra reads your pulse and breathing rate, plus HRV when the signal is good enough, and Setnote saves the reading next to the exercise you just did. After a few weeks you can see which sets push you hardest and how fast you settle between them.

Lifters log weight and reps, but hardly anyone logs how their body took a set, because that used to mean wearing a chest strap or a watch. SmartSpectra gets the same signals from the camera on the phone that's already in your hand between sets.

Setnote is one React Native codebase that runs on iOS and Android. The SmartSpectra check runs on iPhone today, through a native Expo module around the SDK's iOS framework. On Android the module isn't built yet, so the check is hidden and the rest of the app works the same.

The rest of the app is built for the middle of a workout:

- Logging a set takes two taps. The steppers start from your last set, and the rest timer starts when you log.
- You can also just type a note like `80kg 8, 8, 6. Felt easy`. Setnote picks out the weight, sets and reps and offers to log them in one tap ("Log 3 sets").
- Gym signal can be bad, so saves wait offline and sync when you're back online.
- You don't need an account. You start as a guest and can add an email later to keep your data across devices.

## Demo

<!-- TODO: upload demo/out/setnote-demo-final-1080p.mp4 to YouTube (unlisted is fine) and paste the link below. -->
{% embed https://youtu.be/YOUR_VIDEO_ID %}

The video follows one workout: logging a set in two taps, typing a note that turns into sets, agreeing to the camera check, then a live SmartSpectra scan on a real iPhone. Pulse and breathing update as the SDK reports them, and the saved result shows up next to the exercise. The SDK's warm-up is sped up and labelled as sped up. It ends with the architecture and the data-handling details.

The opening gym clip is stock footage from Pexels, labelled "Illustrative · Stock" in the video, and the narration is an ElevenLabs voice. Credits are in `demo/script-two-voices.md`.

## Code

{% github vickywane/setnote %}

<!-- The README covers setup: Supabase project, migrations (`npm run db:push`), the `delete-account` Edge Function, the Presage API key, and building the iOS dev client. -->

Stack: Expo SDK 57 / React Native 0.86, Expo Router, Tamagui, TanStack Query with offline persistence, Supabase (Postgres with row-level security, Storage, Edge Functions), and a native Expo module that wraps the SmartSpectra iOS SDK.

## How It Responds to Human Signals

Setnote uses three SmartSpectra signals: pulse rate (bpm), breathing rate (breaths/min) and HRV (RMSSD, ms). It also uses the SDK's validation status and the guidance text that comes with it.

### During a check

1. After you log a set, the exercise shows a **How do you feel?** button. It opens a screen that explains the check (45 seconds, front camera, sit down, catch your breath, find good light) and waits for you to tap **Start**.
2. While it measures, the camera preview sits inside a ring that fills over 45 seconds. Pulse and breathing appear once the SDK reports a value it is confident in. In the demo the first pulse arrives about 25 seconds in, and the video shows that wait in full.
3. The text under the preview comes from the SDK's validation status and guidance, so if you move too much or drift out of frame, the screen tells you to hold still or reframe your face.
4. When time is up, the result screen shows the readings, with a reminder that readings right after training are naturally higher than at rest. **Save with exercise** stores them on that exercise (or on the whole session), and the exercise row then shows a pill like *Pulse 77 · 23 breaths/min*.
5. Setnote compares a reading only with your own earlier checks on the same exercise or session. It doesn't compare you with population norms or colour readings as good or bad.

### How SmartSpectra is wired in

```
iPhone front camera ─▶ SmartSpectra SDK (on device) ─▶ PresageVitals (Expo module, Swift) ─▶ Setnote (React Native) ─▶ Supabase
                                                                                                     only the numbers ▲
```

`modules/presage-vitals` is a local Expo module. Its Swift side sets up `SmartSpectraSDK.shared` and exposes `start(apiKey, videoPath?)`, `stop()` and an `onUpdate` event:

```swift
sdk.config.apiKey = apiKey
sdk.config.enableTelemetry = false
sdk.config.imageOutputEnabled = true
sdk.config.requestedMetrics = SmartSpectraConfig.breathingMetrics + [.pulseRate, .hrv]
```

Every 250 ms the module sends JavaScript the new pulse, breathing and HRV samples (value, confidence, stable flag, timestamp) along with the processing and validation status. A native view shows the SDK's camera image as the preview.

On the JavaScript side, the saved result is the median of the good samples. A sample counts only if its confidence is 60 or higher, and when the SDK has marked any samples as stable, only those count. That way one shaky early value can't become the saved reading.

The check runs only while its screen is open. Leaving the screen, cancelling, or sending the app to the background stops the SDK. On devices where the SDK isn't available, or when no Presage key is set, the feature is hidden. The app never fakes a measurement.

## Prize Categories

I'm entering **Best Thoughtful Real-World Use**.

Strength training runs on feel: a set felt hard, so you rest longer. Feel is unreliable, though, and most people don't own a chest strap or want to wear one mid-workout. They already have their phone out between sets.

Setnote is for recreational lifters who keep a training log and want a low-effort read on how hard their training is, without buying hardware.

Everything is built for the minute after a set. The tap targets are big and logging takes two taps, because your hands are sweaty. The check is one tap from the exercise you just did, and the reading lands next to that exercise instead of in a separate health dashboard. Saving works offline for basement gyms. And the wording treats every number as a wellness reading, never a verdict.

## Consent and Data Handling

### Camera consent

- The first time you open the check, it explains what it measures and what it keeps, and asks you to agree before the camera can start. You can turn the whole feature off again in Settings.
- The camera runs only on the check screen, only after you tap **Start**, and for 45 seconds. It stops if you cancel, leave the screen or background the app. iOS asks for camera permission the first time, and if you deny it, the app explains how to allow it in Settings.
- The check screen says: *For general wellness only. Not a medical device, and not for diagnosing or treating anything.* Setnote makes no diagnosis or treatment claims and doesn't make medical decisions.

### What is processed, stored and shared

- Video: SmartSpectra works out pulse, breathing and HRV on the phone. Setnote doesn't keep or upload the check video unless you turn on the option below.
- Optional check videos: Save check videos in Settings is off by default. When it's on, each check asks first. If you have an account, the recording is stored privately in Supabase Storage where only you can read it. As a guest, it stays on the phone. You can delete it at any time.
- Readings: Setnote saves only the numbers (pulse, breathing rate, HRV when available) and their timestamp to your account in Supabase. Row-level security means only you can read them.
- Retention and deletion: readings stay until you delete them. Removing the exercise, deleting the session, or deleting your account (Settings › Delete account) deletes them. Deleting your account also removes any saved videos and recordings, on the server and on the phone.
- SDK telemetry: off (`enableTelemetry = false`), so the SDK sends Presage no session summaries or device reports. It still makes authenticated requests to Presage, for example to check the API key. Presage's docs say those requests can be linked to the app's Presage account, so I don't describe them as anonymous.
- Optional AI service: when you write a note while online, Setnote sends the note's text to a Supabase Edge Function, which asks Anthropic's Claude to pick out exercises, weights and reps. No camera data or vitals are ever sent. Offline, or if the function isn't deployed, a parser on the phone does the same job.
- Analytics: none are sent. The app has an opt-in for anonymous usage events, but this build has no analytics provider configured.
- Sharing: Setnote doesn't sell your data or share it with anyone beyond the services above (Supabase for storage, Presage for the SDK's key check, Anthropic for optional note reading).

## Testing Notes

You don't need to log in: the app starts a guest session on its own. The SmartSpectra check needs a physical iPhone, a Presage API key (`EXPO_PUBLIC_PRESAGE_API_KEY`) and a development build. On the simulator, or without a key, the check is hidden and the rest of the app works. Setup steps are in the README.

## Agent Session

<!-- Optional: upload the Claude Code session transcript at https://dev.to/agent_sessions/new, curate it, set it to public, check it for keys and personal data, then embed it here. Delete this section if you skip it. -->

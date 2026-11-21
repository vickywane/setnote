# Setnote — staged build prompts

Setnote is the name of this project. 

Use these prompts in order in the coding agent or app builder you use elsewhere. Keep the same project and agent context between stages. Each stage should finish with a runnable, reviewable app before you continue.

## Before you start

- **Figma file:** [Gym Notes — Screens v2](https://www.figma.com/design/jaxQ6LePZUM7qcP3lADmCe/Gym-Notes?node-id=14-36)  
  Review the available frames in this file and follow the design over descriptive approximations. If a specific interaction state is absent, use these prompts and existing app behavior to define it.
- **App:** Gym Notes, a mobile-first workout journal. Product name is provisional.
- **Platforms:** iOS and Android. Portrait phone layout is primary; responsive web can be a useful secondary target, but do not compromise native behavior.
- **Stack:** Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Tamagui, Supabase (Postgres, Auth, Storage, Edge Functions), TanStack Query, Zustand, AsyncStorage. Use a custom Expo development build for native modules; Expo Go is insufficient for speech recognition and other native integrations.
- **Expo documentation rule:** before using or changing an Expo, EAS, or React Native API, inspect `package.json` for the installed Expo major and fetch the matching versioned documentation. For this project use [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) and the [Expo docs index for LLMs](https://docs.expo.dev/llms.txt), then follow links to the exact API page. Do not rely on remembered APIs. Use `npx expo install <package>` for SDK-compatible native packages. If the target platform has a different installed Expo major, re-check its matching docs first.
- **Navigation:** Expo Router only. Route screens belong in `src/app/`; reusable components and feature logic belong elsewhere.
- **Backend:** Supabase is authoritative for user-owned workout data. Use RLS for every user-owned table and never put service-role keys or vendor secrets in the app. The app can start in anonymous guest mode; linking an email/password account must preserve the same user and their data.
- **Design:** calm, editorial training journal; warm off-white/white surfaces, dark ink text, restrained blue accent, fine separators, compact uppercase overlines, Geist / Geist Mono / Newsreader typography where available. Follow the Figma file over descriptive approximations. Mobile touch targets, safe areas, keyboard, accessibility, and reduced motion matter.
- **Existing source of truth:** when available, inspect `README.md`, `src/`, `assets/`, `supabase/migrations/`, and tests before implementing. Preserve verified behavior and naming. Do not copy credentials, project IDs, or personal data from another environment.
- **Working style:** implement only the current stage, summarize changed files and decisions, and stop for review. Avoid placeholder buttons and fake persistence. Use believable empty, loading, error, offline, and success states. Do not silently omit a feature; state external credentials, hardware, or platform limitations explicitly.

---

## Prompt 1 — Foundation, design system, and Supabase

Build the foundation for **Gym Notes**, using the project brief above. Begin by inspecting the current repository and the linked Figma file. Report the screens, reusable patterns, tokens, and available assets you found before coding.

Set up Expo SDK 57 / React Native / strict TypeScript / Expo Router / Tamagui, with a maintainable feature-oriented structure. Establish typography, colors, spacing, borders, shadows, icons, safe-area handling, buttons, list rows, cards, bottom sheets, empty/loading/error states, and accessible touch targets. Match the Figma design system and keep content readable on small iPhones and Android phones. Use the included Geist, Geist Mono, and Newsreader fonts if licensed assets and package setup support them.

Set up Supabase client configuration from public URL and publishable/anon key environment variables. Include a useful missing-config state and local mock/dev mode only if it is clearly isolated. Never commit secrets. Add schema migrations and RLS policies for:

- `exercises`: shared read-only catalog plus user-created entries;
- `workout_sessions` → `session_exercises` → `exercise_sets` for structured workouts;
- `notes`, optionally associated with a session and/or a session exercise, with extracted values;
- recovery-check records only in the later recovery stage.

All user-owned records must be scoped to `auth.uid()`. Include indexes, constraints, and cascading deletion where appropriate. Define TypeScript DB types from the schema. Add Supabase Auth anonymous guest initialization and session persistence without losing the guest account when linking credentials.

Create a minimal routed app shell and shared tabs so subsequent stages can be built on top. Do not implement all product screens yet. Follow the Expo documentation rule in the project brief before touching framework APIs.

**Done when:** app boots on iOS and Android development builds, routes work, tokens are centralized, config errors are understandable, migration/RLS design is checked in, and lint/typecheck pass. Report exact setup commands and required environment variables.

---

## Prompt 2 — App shell and Notes home

Implement the primary tab shell and **Notes** home screen from Figma. Keep the screen native-feeling and fast, with pull-to-refresh, safe-area-aware scroll content, and thumb-reachable primary action.

The home screen should include:

- Header with title, profile/account entry, and a compact weekly day strip/calendar.
- Day selection that filters the visible workout/note entries for that date; clear selected date when tapped again.
- Primary “Log sets” action that resumes an unfinished workout or starts one. A separate create-session action starts a fresh workout; if a paused workout exists, explain the consequence and let the user resume, cancel, or finish it before starting another.
- “Write a note” path for a standalone journal note.
- Paused workout card with resume behavior; dismiss only for the current visit.
- Recent notes and day entries, with correct empty, loading, error, and refresh states.
- Profile path to Settings/account state.

Use Supabase-backed hooks and TanStack Query caching/invalidation. Do not show fabricated records. Create an initial empty state that explains both logging paths. Preserve calendar date boundaries and the behavior that an empty abandoned workout is discarded rather than placed in History.

**Done when:** first launch is useful without data, calendar selection works, new and paused workout paths are distinguishable, and real entries route to their detail screens (which may be added in the next stage).

---

## Prompt 3 — Structured workout flow

Implement the full structured workout session flow, matching Figma screens and sheets.

### Flow

1. From Notes, start or resume a session. Create its Supabase row promptly and show an elapsed timer.
2. Add exercises from a searchable built-in catalog. Allow users to create custom exercises with name, aliases, and equipment. Do not lose the current session when opening sheets or another route.
3. Show each exercise with equipment, prior performance, logged sets, and exercise options. Support adding the same exercise more than once if the source design allows it.
4. Log and edit sets using a focused sheet: weight, reps, and set type (including warm-up/drop/cluster types supported by the data model). Provide sensible increments and default from a prior set or recent performance. Honor kg/lb preference and conversions.
5. Give immediate optimistic feedback; support undo for destructive or mistaken set actions. Persist mutations and recover from network errors without silently dropping edits.
6. Allow exercise note and recovery-check entry points, rename session, remove exercise, and session options.
7. “Wrap up” summarizes exercises, set count, duration, and any new personal best. Let the user add a session note, finish, or discard with a clear confirmation. Finished session remains viewable from History.

Session timer counts time while the session screen is active; leaving pauses it and returning resumes it. A session with no exercises is discarded when abandoned. Preserve an unfinished session when the app backgrounds or is killed. Use optimistic updates carefully and make the action bar, sheets, keyboard, and scrolling work on small phones. Add accessible labels and reduced-motion behavior.

**Done when:** a user can create a session, log/edit/remove sets, leave and resume, finish or discard, and see persisted data after restart. Include useful empty/error/loading states and verify all route transitions.

---

## Prompt 4 — Freeform, exercise notes, voice, and extraction

Implement the journal note flows and connect them to the workout flow.

### Note screens and flows

- Standalone note editor with a quiet lined-paper writing surface, autosave, back navigation, and delete/edit actions.
- Exercise note editor associated with one exercise in one session. Show the exercise/session context and last performance. Save notes in the shared `notes` model, not a disconnected local-only store.
- Voice capture on supported devices: permission education, recording timer/state, pause/resume/stop, transcription into editable text, playback or removal of clips where supported, and graceful denial/unavailable/offline handling. Do not upload or retain audio unless the user-facing product design explicitly requires it.
- “Picked up” extraction preview that identifies exercise, equipment, weight/unit, sets, reps, set changes, effort, goals, and body notes. Never invent missing values; mark unknown or ambiguous fields. Allow correction before relying on extracted values.
- Parse locally first for immediate feedback. Add an optional Supabase Edge Function for richer extraction (Anthropic credentials remain server-side); validate output against known exercise IDs and sensible value ranges. If the function is unavailable/offline, keep the local parse and the note usable.
- Cache extraction by note text and update extraction when text changes. Explain when a reading is still being processed.
- Search notes from the home screen and navigate to the correct standalone/exercise note.

Use Expo SDK 57 documentation for audio and speech APIs, and `npx expo install` for compatible native packages. A custom development build may be required. Request only permissions needed and only at the point they are needed.

**Done when:** typing works with the keyboard, notes autosave reliably, voice is optional and recoverable, parsing is cautious, extraction failure never blocks saving, and note links remain correct after session edits/deletion.

---

## Prompt 5 — History, progress, Settings, and accounts

Implement History and Settings and complete the account lifecycle.

### History

- Chronological journal grouped by day, with month headings, workout entries, standalone notes, and exercise notes where appropriate.
- Workout entries show start time, duration or “in progress,” exercise names, volume/set metadata, and personal-best marker when supported by previous data.
- Tapping an entry opens the session or correct note. Pull-to-refresh and clear loading/error/empty states.

### Settings and account

- Guest account card explaining data is tied to the current anonymous account/device until linked; add-email and sign-in flows.
- Email/password sign-in and account linking must preserve the existing anonymous Supabase user and all records; signing out creates a fresh guest session.
- kg/lb preference persisted locally and used consistently across all workout/history screens.
- User-created exercise catalog management if supported by current design.
- Delete-my-data/delete-account flow with explicit confirmation, server-side account deletion, and removal of associated storage objects.
- Keep preferences accessible, legible, and consistent with Figma.

Use Supabase RLS for all data operations. Handle expired sessions, network failures, duplicate email, invalid credentials, and destructive confirmation. Do not display counts or account claims until data has loaded.

**Done when:** history is derived from real saved records, navigation works in both directions, unit choice persists, guest-to-email linking keeps the same data, and deletion is complete and safe.

---

## Prompt 6 — Optional iOS recovery check

Implement the optional **How do you feel?** recovery check only if the target builder can support a custom Expo native module and the required vendor SDK. It is iOS-only (iOS 17+), requires a real iPhone camera, Presage SmartSpectra SDK access and `EXPO_PUBLIC_PRESAGE_API_KEY`; hide it cleanly on Android, simulator, or missing-key builds. Do not fake biometric readings.

On the ready screen, explain the camera measurement and obtain consent before starting. Run the 45-second check only while its screen is foregrounded; stop on cancel, navigation away, or app background. Present pulse (bpm), breathing rate, HRV/RMSSD (ms), confidence, and scan duration as wellness measurements only—no diagnosis, risk scoring, or advice. Save one reading for the session or for an individual exercise; retaking replaces the earlier check. Compare against that user's earlier readings for the same exercise/session context, with simple directional indicators and no evaluative colors.

Store summary metrics in Supabase `recovery_checks`, protected by RLS and linked to the owning session and optional session exercise. Never store raw camera frames by default. If implementing opt-in “Save check videos,” make the setting off by default; explain destination before enabling; guest videos stay on device, signed-in videos use a private RLS-protected Supabase Storage bucket and short-lived signed URLs. Delete video on failed/cancelled/unsaved checks; allow deleting a video while retaining its metrics. Withdraw consent in Settings and disable video capture when consent is withdrawn. Turn off SDK telemetry if the SDK supports it.

Use the vendor's current official docs and Expo SDK 57 native-module/config-plugin docs; keep secrets off the client except the vendor's specifically public app key. Provide a build/setup note for the SDK dependency and required real-device verification.

**Done when:** supported iPhones can consent, scan, stop, save, retake, compare, and optionally replay/delete videos; unsupported devices show no dead control and data remains private.

---

## Prompt 7 — Integration pass and release readiness

Review the whole app against the Figma file, the feature prompts, and the real user journeys. Do not add unrelated features. Fix integration gaps, broken routes, inconsistent units, duplicate query state, unsafe RLS, or visual mismatches.

### QA journeys

1. Fresh install → anonymous guest → Notes empty state → write/save/search a note → edit/delete it.
2. Guest → start session → add exercise → log/edit/undo sets → add exercise note → leave/resume → finish → History → reopen.
3. Paused session → resume; paused session → start another and confirm old session behavior.
4. Switch kg/lb → verify values and labels remain correct in session, prior performance, and History.
5. Link guest account to email → restart app → verify same user and data; sign out → fresh guest.
6. Offline/server error → notes remain usable, failed writes are visible/retryable, no false success.
7. Permission denied for microphone/speech/camera → app remains usable and gives a recovery path.
8. Recovery: supported real iPhone consent/scan/cancel/retake/video privacy; Android/missing key shows no recovery action.

Check iOS and Android phone layouts, small screen/large text, VoiceOver/TalkBack labels, keyboard overlap, safe areas, contrast, reduced motion, loading/empty/error states, and app background/resume. Validate Supabase RLS policies and account deletion paths. Add focused tests for domain logic and primary flows.

Use the commands supported by the generated repo and its package manager. For this Yarn project: `yarn lint`, `yarn typecheck`, and `yarn test`; also run the matching `npx expo-doctor` and build/start a development client where possible. Do not claim a real-device, backend, or build check that was not actually run. Report passed checks, known limitations, setup variables, migrations, and exact run/build instructions.

**Release gate:** no broken primary flow, no fake persisted data, no client secrets, no cross-user reads/writes, no misleading recovery output, and no known lint/type/test failures left unexplained.

---

## Prompt QA notes

- Stage ordering follows the actual dependency chain: foundation/backend → home → structured sessions → notes → history/account → optional native recovery → integration QA.
- Requirements are grounded in this repo's README, routes, components, Supabase migrations, and settings. The feature set includes both note-first and structured logging because both are core product paths.
- The source documents Expo SDK 57, Expo Router, Tamagui, Supabase, TanStack Query, Zustand, guest account linking, local parsing plus an optional server-side extraction function, and optional iOS recovery checks. Prompts preserve those boundaries.
- The shareable Figma file URL is recorded above; keep it with the staged prompts so future implementation and review can inspect the same source.
- Existing project IDs, credentials, and third-party keys should be re-created or supplied securely in the destination environment. The prompt intentionally does not copy them.
- Expo API guidance is pinned to the documented major version and explicitly tells the downstream agent to re-check if its package major differs.


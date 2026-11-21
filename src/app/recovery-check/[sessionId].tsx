import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { NavBar } from '@/components/ds/nav-bar';
import { AppText } from '@/components/ds/text';
import {
  comparableChecks,
  useRecentRecoveryChecks,
  useSaveRecoveryCheck,
} from '@/features/recovery/api';
import { RecoveryStats, WELLNESS_NOTE } from '@/features/recovery/components';
import { useRecoveryConsentStore } from '@/features/recovery/consent-store';
import { formatRate, hasReading, SCAN_MS, summarize } from '@/features/recovery/summary';
import { useVitalsScan } from '@/features/recovery/use-vitals-scan';
import { videoLocation } from '@/features/recovery/videos';
import { useSession } from '@/features/sessions/api';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { VitalsPreview } from '@/modules/presage-vitals';

/** The camera circle, and the ring of progress dots around it. */
const PREVIEW = 264;
const RING_GAP = 14;
const DOTS = 72;
const DOT = 6;

/**
 * "How do you feel?": a 45-second camera reading of pulse, breathing rate and HRV (Presage
 * SmartSpectra, measured on the phone), saved with one exercise (`exerciseId`, a
 * session_exercises id) or, without it, with the whole session. Asks for consent the first
 * time, and only ever runs while this screen is open.
 */
export default function RecoveryCheckScreen() {
  const { sessionId, exerciseId } = useLocalSearchParams<{
    sessionId: string;
    exerciseId?: string;
  }>();
  const sessionExerciseId = exerciseId || null;
  const session = useSession(sessionId);
  const sessionExercise = session.data?.session_exercises.find((se) => se.id === sessionExerciseId);
  const exerciseName = sessionExercise?.exercise.name;
  const subject = sessionExerciseId ? (exerciseName ?? 'this exercise') : 'this session';
  const insets = useSafeAreaInsets();
  const consentedAt = useRecoveryConsentStore((s) => s.consentedAt);
  const consent = useRecoveryConsentStore((s) => s.consent);
  const setDismissed = useRecoveryConsentStore((s) => s.setDismissed);
  const saveVideos = useRecoveryConsentStore((s) => s.saveVideos);
  // Per check: on by default when videos are turned on in Settings.
  const [recordVideo, setRecordVideo] = useState(saveVideos);
  const scan = useVitalsScan();
  const startScan = () => scan.start({ recordVideo: saveVideos && recordVideo });
  const recent = useRecentRecoveryChecks();
  const save = useSaveRecoveryCheck();

  const summary = scan.result ? summarize(scan.result) : null;
  const previous = comparableChecks(recent.data ?? [], {
    exerciseId: sessionExercise?.exercise_id ?? null,
    excludeSessionId: sessionId,
  });

  useEffect(() => {
    if (scan.phase === 'done') feedback.success('Reading done');
  }, [scan.phase]);

  const close = () => router.back();

  const saveResult = async () => {
    if (!summary) return;
    try {
      const { videoError } = await save.mutateAsync({
        check: {
          session_id: sessionId,
          session_exercise_id: sessionExerciseId,
          pulse_bpm: summary.pulseBpm,
          breathing_bpm: summary.breathingBpm,
          hrv_ms: summary.hrvMs,
          confidence: summary.confidence,
          duration_ms: SCAN_MS,
        },
        video: scan.video,
      });
      track('recovery_check_saved', {
        scope: sessionExerciseId ? 'exercise' : 'session',
        video: !!scan.video,
      });
      if (videoError) {
        Alert.alert('Saved without the video', `The reading is saved. ${videoError}`);
      }
      close();
    } catch (error) {
      Alert.alert("Couldn't save the recovery check", (error as Error).message);
    }
  };

  const body = () => {
    if (!consentedAt) {
      return (
        <Consent
          onAgree={() => {
            consent();
            track('recovery_check_consented');
          }}
          onNever={() => {
            setDismissed(true);
            close();
          }}
        />
      );
    }

    if (scan.phase === 'idle') {
      return (
        <Section
          title={`How do you feel after ${subject}?`}
          text="Sit down, catch your breath for a moment, then hold the phone at arm’s length with your face in good, even light. Stay still and keep talking to a minimum for 45 seconds.">
          {saveVideos && (
            <VideoSwitch
              value={recordVideo}
              onChange={setRecordVideo}
              where={videoLocation() === 'cloud' ? 'account' : 'phone'}
            />
          )}
          <Button label="Start" onPress={startScan} />
        </Section>
      );
    }

    if (scan.phase === 'starting' || scan.phase === 'scanning') {
      const progress = scan.phase === 'scanning' ? scan.elapsedMs / SCAN_MS : 0;
      const remaining = Math.ceil((SCAN_MS - scan.elapsedMs) / 1000);
      return (
        <YStack gap="$5" alignItems="center">
          <CameraRing progress={progress} steady={scan.validation === 'ok'} />
          <AppText variant="title" textAlign="center">
            {`How do you feel after ${subject}?`}
          </AppText>
          <AppText variant="body" color="$colorMuted" textAlign="center" minHeight={46}>
            {scan.phase === 'starting' ? 'Starting the camera…' : (scan.hint ?? 'Hold still')}
          </AppText>
          <XStack gap={28} justifyContent="center">
            <LiveStat value={formatRate(scan.live.pulse)} label="pulse bpm" />
            <LiveStat value={formatRate(scan.live.breathing)} label="breaths/min" />
            {scan.phase === 'scanning' && <LiveStat value={`${remaining}s`} label="left" />}
          </XStack>
          <Button label="Cancel" kind="secondary" alignSelf="stretch" onPress={scan.cancel} />
        </YStack>
      );
    }

    if (scan.phase === 'error') {
      return (
        <Section title="The check stopped" text={scan.error ?? 'Something went wrong.'}>
          <Button label="Try again" onPress={startScan} />
        </Section>
      );
    }

    // Done.
    if (!summary || !hasReading(summary)) {
      return (
        <Section
          title="No clear reading"
          text="The camera couldn’t get a steady enough signal. Try again sitting still, facing the light, with your whole face in view.">
          <Button label="Try again" onPress={startScan} />
        </Section>
      );
    }
    return (
      <YStack gap="$5">
        <AppText variant="title">{`After ${subject}`}</AppText>
        <RecoveryStats summary={summary} previous={previous} />
        <AppText variant="caption" color="$color9">
          Readings right after training are naturally higher than at rest. Comparing checks taken
          the same way each time shows how you’re trending.
        </AppText>
        {(scan.video || scan.videoFinishing) && (
          <AppText variant="caption" color="$color9">
            {scan.videoFinishing
              ? 'Finishing the video…'
              : `A ${Math.round((scan.video?.durationMs ?? 0) / 1000)}-second video is saved with it, ${
                  videoLocation() === 'cloud' ? 'privately in your account' : 'on this phone only'
                }. Retake or close to discard it.`}
          </AppText>
        )}
        <YStack gap="$3">
          <Button
            label={sessionExerciseId ? 'Save with exercise' : 'Save with session'}
            loading={save.isPending || scan.videoFinishing}
            onPress={() => void saveResult()}
          />
          <Button label="Retake" kind="secondary" onPress={startScan} />
        </YStack>
      </YStack>
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <NavBar backLabel="Done" onBack={close} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
          gap: 24,
        }}>
        {body()}
        <AppText variant="caption" color="$color9" marginTop="auto">
          {WELLNESS_NOTE}
        </AppText>
      </ScrollView>
    </YStack>
  );
}

function Section({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <AppText variant="title">{title}</AppText>
        <AppText variant="body" color="$colorMuted">
          {text}
        </AppText>
      </YStack>
      {children}
    </YStack>
  );
}

/**
 * The live camera feed in a circle, ringed by dots that fill as the 45 seconds pass. The
 * filled dots are green while the SDK has a steady view of the face.
 */
function CameraRing({ progress, steady }: { progress: number; steady: boolean }) {
  const size = PREVIEW + RING_GAP * 2 + DOT;
  const radius = PREVIEW / 2 + RING_GAP;
  const filled = Math.round(progress * DOTS);
  return (
    <YStack width={size} height={size} alignItems="center" justifyContent="center">
      {Array.from({ length: DOTS }, (_, i) => {
        const angle = (i / DOTS) * 2 * Math.PI - Math.PI / 2;
        return (
          <YStack
            key={i}
            position="absolute"
            left={size / 2 + radius * Math.cos(angle) - DOT / 2}
            top={size / 2 + radius * Math.sin(angle) - DOT / 2}
            width={DOT}
            height={DOT}
            borderRadius={DOT / 2}
            backgroundColor={i < filled ? (steady ? '$green9' : '$color12') : '$color5'}
          />
        );
      })}
      <YStack
        width={PREVIEW}
        height={PREVIEW}
        borderRadius={PREVIEW / 2}
        overflow="hidden"
        backgroundColor="$color3">
        {VitalsPreview && <VitalsPreview style={{ width: PREVIEW, height: PREVIEW }} />}
      </YStack>
    </YStack>
  );
}

/** "Save a video of this check", on the Ready screen when videos are on in Settings. */
function VideoSwitch({
  value,
  onChange,
  where,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  where: 'account' | 'phone';
}) {
  return (
    <XStack gap="$3" alignItems="center">
      <YStack flex={1} gap={2}>
        <AppText variant="bodyStrong">Save a video of this check</AppText>
        <AppText variant="caption" color="$color9">
          {where === 'account'
            ? 'Kept privately in your account, to watch again. Only you can see it.'
            : 'Kept on this phone only, to watch again. Add an email to keep videos in your account.'}
        </AppText>
      </YStack>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel="Save a video of this check"
      />
    </XStack>
  );
}

function LiveStat({ value, label }: { value: string; label: string }) {
  return (
    <YStack alignItems="center">
      <AppText variant="numeralL">{value}</AppText>
      <AppText variant="caption" color="$color9">
        {label}
      </AppText>
    </YStack>
  );
}

const CONSENT_POINTS = [
  'Uses the front camera for 45 seconds, only while this screen is open. You can stop at any time.',
  'Presage’s SmartSpectra SDK works out pulse, breathing rate and HRV on your phone; the SDK never sends your video anywhere.',
  'Only those three numbers are saved, with the exercise or session in your Setnote account. Removing the exercise or deleting the session or your account deletes them.',
  'Your face isn’t recorded unless you turn on Save check videos in Settings. Then each check asks first, and the video is kept privately in your account (or on this phone as a guest) until you delete it.',
  'The SDK contacts Presage to check this app’s licence. Its usage telemetry is turned off.',
];

function Consent({ onAgree, onNever }: { onAgree: () => void; onNever: () => void }) {
  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <AppText variant="title">Check how you feel</AppText>
        <AppText variant="body" color="$colorMuted">
          After an exercise or a whole session, read your pulse, breathing rate and heart rate
          variability from your phone’s camera, and see how they compare with your usual.
        </AppText>
      </YStack>
      <YStack gap="$3">
        {CONSENT_POINTS.map((point) => (
          <XStack key={point} gap="$2">
            <AppText variant="body">•</AppText>
            <AppText variant="body" flex={1}>
              {point}
            </AppText>
          </XStack>
        ))}
      </YStack>
      <YStack gap="$3">
        <Button label="I agree, continue" onPress={onAgree} />
        <Button label="Don’t offer this again" kind="ghost" onPress={onNever} />
      </YStack>
    </YStack>
  );
}

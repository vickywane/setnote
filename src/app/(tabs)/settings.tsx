import Constants from 'expo-constants';
import { type ReactNode, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Button, ListRow } from '@/components/ds/controls';
import { AppText } from '@/components/ds/text';
import { signOut } from '@/features/auth/account';
import { isGuest, useUser } from '@/features/auth/auth-store';
import { type AccountMode, AccountSheet, DeleteDataSheet } from '@/features/auth/components';
import { useExercises } from '@/features/catalog/api';
import { useNotes } from '@/features/notes/api';
import { useRecoveryConsentStore } from '@/features/recovery/consent-store';
import { recoveryCheckAvailable } from '@/features/recovery/use-vitals-scan';
import { useSessions } from '@/features/sessions/api';
import { hasAnalyticsProvider } from '@/lib/analytics';
import { plural } from '@/lib/format';
import { usePreferencesStore } from '@/stores/preferences-store';

/** Figma "Settings / Guest" and "Settings / Signed in". */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const guest = isGuest(user);
  const weightUnit = usePreferencesStore((s) => s.weightUnit);
  const setWeightUnit = usePreferencesStore((s) => s.setWeightUnit);
  const recoveryOffered = !useRecoveryConsentStore((s) => s.dismissed);
  const recoveryConsented = !!useRecoveryConsentStore((s) => s.consentedAt);
  const saveVideos = useRecoveryConsentStore((s) => s.saveVideos);
  const shareUsage = usePreferencesStore((s) => s.shareUsage);

  const sessions = useSessions().data ?? [];
  const notes = (useNotes().data ?? []).filter((n) => n.body.trim());
  const customExercises = (useExercises().data ?? []).filter((e) => e.user_id !== null);
  const logged = `${plural(sessions.length, 'session')} and ${plural(notes.length, 'note')}`;

  const [accountMode, setAccountMode] = useState<AccountMode>('create');
  const [accountOpen, setAccountOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const openAccount = (mode: AccountMode) => {
    setAccountMode(mode);
    setAccountOpen(true);
  };

  const runSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      Alert.alert("Couldn't sign out", error instanceof Error ? error.message : String(error));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 24,
        }}>
        <AppText variant="display" role="heading" aria-level={1}>
          Settings
        </AppText>

        <YStack
          gap="$3"
          paddingHorizontal="$4"
          paddingVertical={18}
          borderRadius="$4"
          backgroundColor="$color2">
          {guest ? (
            <>
              <AppText variant="heading">You’re logging as a guest</AppText>
              <AppText color="$colorMuted">
                Your {logged} are tied to this phone. Add an email so you don’t lose them if you
                switch phones or delete the app.
              </AppText>
              <XStack gap="$2">
                <Button
                  size="md"
                  width={160}
                  label="Add an email"
                  onPress={() => openAccount('create')}
                />
                <Button
                  size="md"
                  width={160}
                  kind="ghost"
                  label="I have an account"
                  onPress={() => openAccount('signin')}
                />
              </XStack>
            </>
          ) : (
            <>
              <AppText variant="heading" numberOfLines={1}>
                Signed in as {user?.email}
              </AppText>
              <AppText color="$colorMuted">
                Your {logged} are saved to your account, so they come with you to a new phone.
              </AppText>
              <XStack>
                <Button
                  size="md"
                  width={160}
                  kind="secondary"
                  label="Sign out"
                  loading={signingOut}
                  onPress={() => void runSignOut()}
                />
              </XStack>
            </>
          )}
        </YStack>

        <Group title="PREFERENCES">
          <ListRow
            label="Weight unit"
            value={weightUnit}
            last={!recoveryCheckAvailable()}
            onPress={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}
          />
          {recoveryCheckAvailable() && (
            <>
              <ListRow
                label="How-do-you-feel checks"
                value={recoveryOffered ? 'On' : 'Off'}
                last={!recoveryOffered && !recoveryConsented}
                onPress={() => useRecoveryConsentStore.getState().setDismissed(recoveryOffered)}
              />
              {recoveryOffered && (
                <ListRow
                  label="Save check videos"
                  value={saveVideos ? 'On' : 'Off'}
                  last={!recoveryConsented}
                  onPress={() => toggleSaveVideos(!saveVideos, guest)}
                />
              )}
              {recoveryConsented && (
                <ListRow
                  label="Withdraw camera consent"
                  last
                  onPress={() => useRecoveryConsentStore.getState().withdraw()}
                />
              )}
            </>
          )}
        </Group>

        <Group title="YOUR DATA">
          {hasAnalyticsProvider() && (
            <ListRow
              label="Share anonymous usage"
              value={shareUsage ? 'On' : 'Off'}
              onPress={() => toggleShareUsage(!shareUsage)}
            />
          )}
          <ListRow
            label={guest ? 'Delete my data' : 'Delete account'}
            tone="destructive"
            last
            onPress={() => setDeleteOpen(true)}
          />
        </Group>

        <AppText variant="caption" color="$color9">
          Setnote {Constants.expoConfig?.version} · made for people who still use notebooks
        </AppText>
      </ScrollView>
      {/* Content scrolls under the status bar; keep it on white like the page. */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        height={insets.top}
        backgroundColor="$background"
      />

      <AccountSheet
        mode={accountMode}
        onModeChange={setAccountMode}
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        guestData={guest && (sessions.length > 0 || notes.length > 0) ? logged : null}
      />
      <DeleteDataSheet
        guest={guest}
        summary={deleteSummary(sessions.length, notes.length, customExercises.length)}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </YStack>
  );
}

/** Overline over a bordered group of ListRows (Figma "Preferences", "Your data"). */
/** Turning usage sharing on says what is and isn't sent first; turning it off is immediate. */
function toggleShareUsage(on: boolean) {
  const { setShareUsage } = usePreferencesStore.getState();
  if (!on) {
    setShareUsage(false);
    return;
  }
  Alert.alert(
    'Share anonymous usage?',
    'Setnote would send which features you use, like starting a session or saving a note. Never your notes, exercises, weights or check readings. You can turn this off any time.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Share', onPress: () => setShareUsage(true) },
    ],
  );
}

/**
 * Turning check videos on says where they'll be kept first; turning them off keeps videos
 * already saved (each can be deleted from its check).
 */
function toggleSaveVideos(on: boolean, guest: boolean) {
  const { setSaveVideos } = useRecoveryConsentStore.getState();
  if (!on) {
    setSaveVideos(false);
    return;
  }
  Alert.alert(
    'Save check videos?',
    `Each how-do-you-feel check will offer to save a video of your face, to watch again. ${
      guest
        ? 'As a guest, videos stay on this phone only and are lost if you delete the app.'
        : 'Videos are kept privately in your account; only you can see them.'
    } You can delete any video, and deleting a check, session or your account deletes its video.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn on', onPress: () => setSaveVideos(true) },
    ],
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap={6}>
      <AppText variant="overline">{title}</AppText>
      <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" overflow="hidden">
        {children}
      </YStack>
    </YStack>
  );
}

/** "7 sessions, 4 notes and 2 custom exercises"; custom exercises only when there are some. */
function deleteSummary(sessions: number, notes: number, customExercises: number) {
  const parts = [plural(sessions, 'session'), plural(notes, 'note')];
  if (customExercises > 0) parts.push(plural(customExercises, 'custom exercise'));
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

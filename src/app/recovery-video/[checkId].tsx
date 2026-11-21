import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { NavBar } from '@/components/ds/nav-bar';
import { AppText } from '@/components/ds/text';
import { useRecoveryCheck } from '@/features/recovery/api';
import { RecoveryStats, summaryOf, WELLNESS_NOTE } from '@/features/recovery/components';
import { useCheckVideoSource, useDeleteCheckVideo } from '@/features/recovery/videos';

/**
 * Rewatch a recovery check: its video (from the account, or from this phone for a guest) with
 * the reading taken from it. Deleting the video keeps the reading.
 */
export default function RecoveryVideoScreen() {
  const { checkId } = useLocalSearchParams<{ checkId: string }>();
  const insets = useSafeAreaInsets();
  const check = useRecoveryCheck(checkId);
  const source = useCheckVideoSource(check.data ?? null);
  const deleteVideo = useDeleteCheckVideo();
  const player = useVideoPlayer(source.data ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  const close = () => router.back();
  const data = check.data;
  const subject = data?.session_exercise?.exercise.name ?? 'the session';
  const when = data
    ? new Date(data.created_at).toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const confirmDelete = () => {
    if (!data) return;
    Alert.alert('Delete this video?', 'The reading stays with the exercise or session.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete video',
        style: 'destructive',
        onPress: () =>
          deleteVideo.mutate(data, {
            onSuccess: close,
            onError: (error) => Alert.alert("Couldn't delete the video", error.message),
          }),
      },
    ]);
  };

  const missing = data && !data.video_path;
  const notOnThisPhone = data?.video_location === 'device' && source.isSuccess && !source.data;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <NavBar backLabel="Done" onBack={close} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
          gap: 20,
        }}>
        <YStack gap="$1">
          <AppText variant="overline">{when.toUpperCase()}</AppText>
          <AppText variant="title">{`After ${subject}`}</AppText>
        </YStack>
        <YStack
          aspectRatio={3 / 4}
          borderRadius="$4"
          overflow="hidden"
          backgroundColor="$color12"
          alignItems="center"
          justifyContent="center">
          {source.data ? (
            <VideoView
              player={player}
              nativeControls
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : missing || notOnThisPhone || source.isError ? (
            <AppText variant="body" color="$color1" textAlign="center" padding="$4">
              {notOnThisPhone
                ? 'This video was kept on the phone it was taken on.'
                : missing
                  ? 'This check has no video.'
                  : 'Couldn’t load the video. Check your connection and try again.'}
            </AppText>
          ) : (
            <ActivityIndicator color="white" />
          )}
        </YStack>
        {data && <RecoveryStats summary={summaryOf(data)} />}
        {data?.video_path && (
          <Button
            label="Delete video"
            kind="destructive"
            loading={deleteVideo.isPending}
            onPress={confirmDelete}
          />
        )}
        <AppText variant="caption" color="$color9" marginTop="auto">
          {WELLNESS_NOTE}
        </AppText>
      </ScrollView>
    </YStack>
  );
}

import type { ReactNode, RefObject } from 'react';
import { ScrollView, type TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Button, Tag } from '@/components/ds/controls';
import { BottomSheet } from '@/components/ds/sheet';
import { Icon } from '@/components/ds/icon';
import { NavBar } from '@/components/ds/nav-bar';
import { SyncBanner } from '@/components/ds/sync-banner';
import { useOnline } from '@/hooks/use-online';
import { AppText } from '@/components/ds/text';
import { ExerciseIconTile } from '@/features/catalog/components/exercise-row';
import type { Segment } from '@/features/notes/highlight';
import { NotePaper } from '@/features/notes/components/note-paper';
import {
  AudioClip,
  PendingClip,
  PlaybackDock,
  RecordDock,
  RecordingTimer,
  useDockHeight,
  VoiceButton,
} from '@/features/notes/components/voice';
import { formatElapsed } from '@/features/home/format';
import type { SaveState } from '@/features/notes/use-note-draft';
import type { useNoteVoice } from '@/features/notes/use-note-voice';
import { PopoverMenu } from '@/features/sessions/components/session-chrome';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { speechSupported } from '@/lib/speech';

/** Room under the paper for the collapsed "Picked up" peek. */
const PEEK_CLEARANCE = 140;

const SAVE_STATUS_ENTER = FadeIn.duration(180);

/**
 * Figma "Saved": a check and "Saved" in the nav while the note is in sync. Each state fades in
 * over the last (no fade with Reduce Motion).
 */
export function SaveStatus({ state }: { state: SaveState }) {
  const online = useOnline();
  if (state === 'idle') return null;
  return (
    <Animated.View key={state} entering={SAVE_STATUS_ENTER}>
      {state === 'saving' ? (
        <AppText variant="caption" color="$color9">
          {/* Offline, the save waits for a connection rather than failing. */}
          {online ? 'Saving…' : 'Saves when online'}
        </AppText>
      ) : state === 'error' ? (
        <AppText variant="caption" color="$red9">
          Not saved
        </AppText>
      ) : (
        <XStack gap="$1" alignItems="center" accessible aria-label="Saved">
          <Icon name="check" size={16} color="green9" />
          <AppText variant="caption" color="$colorMuted">
            Saved
          </AppText>
        </XStack>
      )}
    </Animated.View>
  );
}

/**
 * The exercise a note belongs to, between the overline and the paper: its name in Newsreader,
 * the equipment, and what you did last time for context while you write.
 */
export function NoteExerciseHeader({
  name,
  equipment,
  lastTime,
}: {
  name: string;
  equipment: string | null;
  lastTime: string | null;
}) {
  return (
    <XStack gap="$3" alignItems="center">
      <ExerciseIconTile name={name} />
      <YStack flex={1} gap={2}>
        <XStack gap="$2" alignItems="center">
          <AppText variant="title" flexShrink={1} numberOfLines={1}>
            {name}
          </AppText>
          {equipment && <Tag text={equipment} />}
        </XStack>
        {lastTime && (
          <AppText variant="caption" color="$color9" numberOfLines={1}>
            {lastTime}
          </AppText>
        )}
      </YStack>
    </XStack>
  );
}

/**
 * Figma "Note / Writing": nav (back, Saved, ⋯), an overline, the note's context and voice
 * recordings, then lined paper filling the screen with the "Picked up" peek over its foot and
 * the mic floating above that.
 */
export function NoteScreen({
  backLabel,
  onBack,
  saveState,
  onMore,
  overline,
  header,
  paperRef,
  segments,
  onChangeText,
  placeholder,
  autoFocus,
  footer,
  voice,
  children,
}: {
  backLabel: string;
  onBack: () => void;
  saveState: SaveState;
  onMore?: () => void;
  /** "19:10 · WRITTEN NOTE"; exercise notes show the exercise instead. */
  overline?: string;
  header?: ReactNode;
  paperRef?: RefObject<TextInput | null>;
  segments: Segment[];
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Bottom chrome over the paper: the Picked up peek. */
  footer?: ReactNode;
  /**
   * Voice (Figma "05 · Voice notes"): recordings at the top of the note, the mic above the peek,
   * and the Record or Playback dock in place of the peek while in use.
   */
  voice?: ReturnType<typeof useNoteVoice>;
  /** Sheets and menus. */
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // The peek, docks and mic sit on the keyboard while it's up. Their own bottom padding clears
  // the home indicator, which the keyboard covers, so it tucks underneath. Dragging the page
  // down puts the keyboard away.
  const chromeBottom = Math.max(0, keyboard - insets.bottom);
  const recording = voice?.recordingActive ?? false;
  const canSpeak = !!voice && speechSupported;
  // The mic is always a small button at the side, above the Picked up peek; the Record dock
  // takes the foot only while recording, and the Playback dock while a recording plays.
  const dock: 'record-live' | 'playback' | null = !voice
    ? null
    : recording
      ? 'record-live'
      : voice.player.open
        ? 'playback'
        : null;
  const dockHeight = useDockHeight(dock);
  const hasClips = !!voice && (voice.recordings.length > 0 || voice.pending.length > 0);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <NavBar backLabel={backLabel} onBack={onBack}>
        {voice && recording ? (
          <RecordingTimer clock={voice.voice.clock} paused={voice.voice.state === 'paused'} />
        ) : (
          <>
            <SaveStatus state={saveState} />
            {onMore && (
              <XStack
                role="button"
                accessible
                aria-label="Note options"
                onPress={onMore}
                hitSlop={10}
                marginLeft="$1"
                opacity={{ default: 1, press: 0.6 }}>
                <Icon name="more" size={24} />
              </XStack>
            )}
          </>
        )}
      </NavBar>
      <SyncBanner />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: Math.max(PEEK_CLEARANCE + insets.bottom, dockHeight + 24),
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        <YStack gap="$1" paddingTop="$3" paddingHorizontal="$5" paddingBottom="$3">
          {overline && (
            <AppText variant="overline">
              {voice?.listening
                ? `${overline} · ${voice.voice.state === 'paused' ? 'PAUSED' : 'LISTENING'}`
                : overline}
            </AppText>
          )}
          {header}
          {voice && hasClips && (
            <YStack gap="$2" paddingTop="$3">
              {voice.recordings.map((clip) => {
                const open = voice.player.open?.id === clip.id;
                return (
                  <AudioClip
                    key={clip.id}
                    recording={clip}
                    open={open}
                    playing={open && voice.player.playing}
                    loading={open && voice.player.loading}
                    positionMs={open ? voice.player.positionMs : 0}
                    onToggle={() => voice.player.toggle(clip)}
                    onDelete={() => voice.askDelete(clip)}
                    onMenu={({ y, height }) => voice.openMenu(clip, y + height + 8)}
                  />
                );
              })}
              {voice.pending.map((clip) => (
                <PendingClip key={clip.key} durationMs={clip.durationMs} />
              ))}
            </YStack>
          )}
        </YStack>
        <NotePaper
          ref={paperRef}
          segments={voice ? voice.withLiveWords(segments) : segments}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoFocus={autoFocus}
          editable={!recording}
          accessibilityLabel="Note text"
        />
      </ScrollView>
      <YStack
        position="absolute"
        left={0}
        right={0}
        top={0}
        bottom={chromeBottom}
        pointerEvents="box-none">
        {dock === null && footer}
        {voice && canSpeak && dock === null && (
          <VoiceButton onPress={() => void voice.voice.record()} />
        )}
        {voice && dock === 'record-live' && (
          <RecordDock
            state={voice.voice.state}
            levels={voice.voice.levels}
            onRecord={() => void voice.voice.record()}
            onStop={voice.voice.stop}
            onPause={voice.voice.pause}
            onDiscard={voice.voice.discard}
          />
        )}
        {voice && dock === 'playback' && voice.player.open && (
          <PlaybackDock
            playing={voice.player.playing}
            loading={voice.player.loading}
            positionMs={voice.player.positionMs}
            durationMs={voice.player.durationMs}
            rate={voice.player.rate}
            onToggle={() => voice.player.open && voice.player.toggle(voice.player.open)}
            onSeek={voice.player.seekTo}
            onBack={voice.player.back}
            onForward={voice.player.forward}
            onRate={voice.player.cycleRate}
            onShare={() => voice.player.open && void voice.share(voice.player.open)}
          />
        )}
      </YStack>
      {voice && <VoiceMenus voice={voice} />}
      {children}
    </YStack>
  );
}

/** The clip's long-press menu and the Delete recording sheet (Figma "Voice / Clip · …"). */
function VoiceMenus({ voice }: { voice: ReturnType<typeof useNoteVoice> }) {
  const menu = voice.menu;
  const deleting = voice.confirmingDelete;
  return (
    <>
      <PopoverMenu
        open={menu !== null}
        onClose={voice.closeMenu}
        top={menu?.top ?? 0}
        left={16}
        width={250}
        scrim
        items={
          menu
            ? [
                {
                  label: 'Play from start',
                  icon: 'play',
                  onPress: () => voice.player.toggle(menu.recording, { fromStart: true }),
                },
                {
                  label: 'Re-transcribe',
                  icon: 'refresh',
                  onPress: () => void voice.retranscribe(menu.recording),
                },
                {
                  label: 'Share audio',
                  icon: 'share',
                  onPress: () => void voice.share(menu.recording),
                },
                {
                  label: 'Delete recording',
                  icon: 'trash',
                  destructive: true,
                  onPress: () => voice.askDelete(menu.recording),
                },
              ]
            : []
        }
      />
      <BottomSheet
        open={deleting !== null}
        onClose={voice.cancelDelete}
        title="Delete this recording?"
        designHeight={360}>
        <AppText color="$colorMuted">
          The {formatElapsed(deleting?.duration_ms ?? 0)} recording is removed. Your transcript and
          the exercises picked up from it stay in this note.
        </AppText>
        <Button
          label="Delete recording"
          kind="destructive"
          loading={voice.deleting}
          onPress={() => void voice.confirmDelete()}
        />
        <Button label="Keep recording" kind="ghost" onPress={voice.cancelDelete} />
      </BottomSheet>
    </>
  );
}

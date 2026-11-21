import { useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { Button, TextField } from '@/components/ds/controls';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { SESSION_NAME_MAX_LENGTH } from '@/features/sessions/session-name';
import { palette } from '@/theme/tamagui.config';

/** Figma "Sheet · Rename session" (360pt). */
export function RenameSessionSheet({
  open,
  name,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  name: string;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Rename session" designHeight={360}>
      {/* Mounted per opening, so it starts from the current name each time. */}
      <RenameForm name={name} saving={saving} onClose={onClose} onSave={onSave} />
    </BottomSheet>
  );
}

function RenameForm({
  name,
  saving,
  onClose,
  onSave,
}: {
  name: string;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  return (
    <>
      <TextField
        value={value}
        onChangeText={setValue}
        placeholder="Session name"
        accessibilityLabel="Session name"
        maxLength={SESSION_NAME_MAX_LENGTH}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onSave(trimmed)}
      />
      <AppText color="$colorMuted">Shown on your Notes home and in History.</AppText>
      <Button label="Save" disabled={!trimmed} loading={saving} onPress={() => onSave(trimmed)} />
      <Button label="Cancel" kind="ghost" onPress={onClose} />
    </>
  );
}

/** Figma "Sheet · Delete this session?" (360pt). */
export function DeleteSessionSheet({
  open,
  name,
  exercises,
  sets,
  deleting,
  onClose,
  onDelete,
}: {
  open: boolean;
  name: string;
  exercises: number;
  sets: number;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const contents =
    exercises === 0
      ? `${name} is removed from History.`
      : `${name}, with its ${exercises} ${exercises === 1 ? 'exercise' : 'exercises'} and ${sets} ${sets === 1 ? 'set' : 'sets'}, is removed from History.`;
  return (
    <BottomSheet open={open} onClose={onClose} title="Delete this session?" designHeight={360}>
      <AppText color="$colorMuted">{contents} This can’t be undone.</AppText>
      <Button label="Delete session" kind="destructive" loading={deleting} onPress={onDelete} />
      <Button label="Keep session" kind="ghost" onPress={onClose} />
    </BottomSheet>
  );
}

export type PersonalBest = { exercise: string; detail: string };

/** Figma "Sheet · Wrap up" (540pt): summary, a new best if any, how it went, and Finish. */
export function WrapUpSheet({
  open,
  minutes,
  sets,
  volume,
  unit,
  best,
  initialNotes,
  finishing,
  onClose,
  onFinish,
  onDiscard,
}: {
  open: boolean;
  minutes: string;
  sets: string;
  volume: string;
  unit: string;
  best: PersonalBest | null;
  initialNotes: string;
  finishing: boolean;
  onClose: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Wrap up" designHeight={540}>
      <XStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" overflow="hidden">
        <SummaryCell value={minutes} label="minutes" />
        <SummaryCell value={sets} label="sets" />
        <SummaryCell value={volume} label={`${unit} lifted`} last />
      </XStack>

      {best && (
        <YStack
          gap={1}
          paddingHorizontal="$3"
          paddingVertical="$3"
          borderRadius="$3"
          backgroundColor="$accent2">
          <AppText variant="bodyStrong" color="$accent11">
            New best on {best.exercise}
          </AppText>
          <AppText variant="caption" color="$accent11">
            {best.detail}
          </AppText>
        </YStack>
      )}

      <FeelAndFinish
        initialNotes={initialNotes}
        finishing={finishing}
        onClose={onClose}
        onFinish={onFinish}
        onDiscard={onDiscard}
      />
    </BottomSheet>
  );
}

/** "How did it go?", Finish, Keep going and Discard; mounted per opening. */
function FeelAndFinish({
  initialNotes,
  finishing,
  onClose,
  onFinish,
  onDiscard,
}: {
  initialNotes: string;
  finishing: boolean;
  onClose: () => void;
  onFinish: (notes: string) => void;
  onDiscard: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <>
      <YStack gap="$2">
        <AppText variant="overline">HOW DID IT GO?</AppText>
        <TextField
          value={notes}
          onChangeText={setNotes}
          placeholder="Sleep, energy, anything that hurt…"
          accessibilityLabel="How did it go?"
          multiline
          style={{
            backgroundColor: palette.color2,
            minHeight: 47,
            lineHeight: 23,
            paddingHorizontal: 12,
          }}
        />
      </YStack>

      <Button label="Finish session" loading={finishing} onPress={() => onFinish(notes.trim())} />

      <XStack alignItems="center" justifyContent="space-between">
        <AppText variant="label" role="button" onPress={onClose} hitSlop={12}>
          Keep going
        </AppText>
        <AppText variant="label" color="$red9" role="button" onPress={onDiscard} hitSlop={12}>
          Discard session
        </AppText>
      </XStack>
    </>
  );
}

function SummaryCell({
  value,
  label,
  last = false,
}: {
  value: string;
  label: string;
  last?: boolean;
}) {
  return (
    <YStack
      flex={1}
      gap={2}
      paddingLeft={14}
      paddingVertical={14}
      borderRightWidth={last ? 0 : 1}
      borderColor="$borderColor">
      <AppText variant="numeralL" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="$color9">
        {label}
      </AppText>
    </YStack>
  );
}

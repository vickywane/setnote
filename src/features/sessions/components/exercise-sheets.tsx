import { useState } from 'react';
import { XStack, YStack } from 'tamagui';

import { Button, ChoiceChip, ListRow, Stepper } from '@/components/ds/controls';
import { Icon } from '@/components/ds/icon';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { EQUIPMENT_LABELS, type Equipment } from '@/features/catalog/api';
import type { ExerciseSet } from '@/features/sessions/api';
import { feedback } from '@/lib/feedback';
import { formatWeightValue } from '@/lib/format';
import type { WeightUnit } from '@/stores/preferences-store';

const SET_TYPES: { value: ExerciseSet['set_type']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'drop', label: 'Drop set' },
  { value: 'failure', label: 'To failure' },
];

/** Steps from the design: 2.5 kg (5 lb) and 1 rep. */
const WEIGHT_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };
/** While a long press repeats, only these values tick, so holding ± doesn't buzz nonstop. */
const WEIGHT_LANDMARK: Record<WeightUnit, number> = { kg: 5, lb: 10 };
const REPS_LANDMARK = 5;
const REST_SECONDS = 90;

export type SetDraft = {
  weight: number;
  reps: number;
  unit: WeightUnit;
  setType: ExerciseSet['set_type'];
};

/**
 * Figma "Sheet · Bicep curl · set 4" (470pt): big ± steppers prefilled from the previous set
 * or last session, the set type, and Log. Editing an existing set reuses it with Save.
 */
export function LogSetSheet({
  open,
  title,
  hint,
  initial,
  setNumber,
  editing,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  title: string;
  hint: string;
  initial: SetDraft;
  setNumber: number;
  editing: boolean;
  onClose: () => void;
  onSubmit: (draft: SetDraft) => void;
  onDelete?: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} designHeight={470}>
      {/* Mounted per opening, so each set starts from its own prefill. */}
      <LogSetForm
        hint={hint}
        initial={initial}
        setNumber={setNumber}
        editing={editing}
        onSubmit={onSubmit}
        onDelete={onDelete}
      />
    </BottomSheet>
  );
}

function LogSetForm({
  hint,
  initial,
  setNumber,
  editing,
  onSubmit,
  onDelete,
}: {
  hint: string;
  initial: SetDraft;
  setNumber: number;
  editing: boolean;
  onSubmit: (draft: SetDraft) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const step = WEIGHT_STEP[draft.unit];
  const change = (patch: Partial<SetDraft>, repeating = false) => {
    const next = { ...draft, ...patch };
    const moved = (Object.keys(patch) as (keyof SetDraft)[]).some((k) => next[k] !== draft[k]);
    if (!moved) return; // Held at 0, or the chip already chosen.
    const landmark =
      (patch.weight !== undefined && patch.weight % WEIGHT_LANDMARK[draft.unit] === 0) ||
      (patch.reps !== undefined && patch.reps % REPS_LANDMARK === 0);
    if (!repeating || landmark) feedback.select();
    setDraft(next);
  };

  return (
    <>
      <AppText color="$colorMuted">{hint}</AppText>
      <XStack gap={22} paddingVertical="$2">
        <Stepper
          label="WEIGHT"
          value={formatWeightValue(draft.weight)}
          unit={draft.unit}
          onDecrement={(repeating) =>
            change({ weight: Math.max(0, draft.weight - step) }, repeating)
          }
          onIncrement={(repeating) => change({ weight: draft.weight + step }, repeating)}
        />
        <Stepper
          label="REPS"
          value={String(draft.reps)}
          unit="reps"
          onDecrement={(repeating) => change({ reps: Math.max(0, draft.reps - 1) }, repeating)}
          onIncrement={(repeating) => change({ reps: draft.reps + 1 }, repeating)}
        />
      </XStack>
      <XStack gap="$2" role="radiogroup" aria-label="Set type">
        {SET_TYPES.map((t) => (
          <ChoiceChip
            key={t.value}
            size="sm"
            label={t.label}
            selected={draft.setType === t.value}
            onPress={() => change({ setType: t.value })}
          />
        ))}
      </XStack>
      <Button
        label={editing ? `Save set ${setNumber}` : `Log set ${setNumber}`}
        onPress={() => onSubmit(draft)}
      />
      {editing && onDelete ? (
        <AppText
          variant="caption"
          color="$red9"
          textAlign="center"
          role="button"
          onPress={onDelete}
          hitSlop={12}>
          Delete set {setNumber}
        </AppText>
      ) : (
        <AppText variant="caption" color="$color9" textAlign="center">
          Rest timer starts when you log · {Math.floor(REST_SECONDS / 60)}:
          {String(REST_SECONDS % 60).padStart(2, '0')}
        </AppText>
      )}
    </>
  );
}

/** Figma "Sheet · Bench press" (500pt): equipment, a note for next time, history, remove. */
export function ExerciseOptionsSheet({
  open,
  name,
  equipmentOptions,
  equipment,
  notes,
  sessionCount,
  onClose,
  onClosed,
  onEquipment,
  onEditNote,
  onSeeHistory,
  onRemove,
}: {
  open: boolean;
  name: string;
  equipmentOptions: Equipment[];
  equipment: Equipment | null;
  notes: string;
  sessionCount: number;
  onClose: () => void;
  /** After the sheet has animated out. */
  onClosed?: () => void;
  onEquipment: (equipment: Equipment) => void;
  /** Opens the note writing screen for this exercise. */
  onEditNote: () => void;
  onSeeHistory: () => void;
  onRemove: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} onClosed={onClosed} title={name}>
      {equipmentOptions.length > 0 && (
        <YStack gap="$2">
          <AppText variant="overline">EQUIPMENT</AppText>
          <XStack gap="$2" flexWrap="wrap" role="radiogroup" aria-label="Equipment">
            {equipmentOptions.map((option) => (
              <ChoiceChip
                key={option}
                label={EQUIPMENT_LABELS[option]}
                selected={equipment === option}
                onPress={() => onEquipment(option)}
              />
            ))}
          </XStack>
        </YStack>
      )}
      <YStack gap="$2">
        <XStack alignItems="center">
          <AppText variant="overline" flex={1}>
            NOTE FOR NEXT TIME
          </AppText>
          <XStack
            role="button"
            accessible
            aria-label={`Edit ${name} note`}
            onPress={onEditNote}
            gap="$1"
            alignItems="center"
            hitSlop={12}
            opacity={{ default: 1, press: 0.6 }}>
            <Icon name="pencil" size={16} />
            <AppText variant="label">Edit</AppText>
          </XStack>
        </XStack>
        <NotePreview notes={notes} onPress={onEditNote} />
      </YStack>
      <YStack>
        <ListRow
          plain
          label={`See every ${name} session`}
          value={String(sessionCount)}
          onPress={onSeeHistory}
        />
        <ListRow plain label="Remove from this session" tone="destructive" onPress={onRemove} />
      </YStack>
    </BottomSheet>
  );
}

/**
 * The exercise's note in the options sheet: its first lines on color2, or a prompt when there's
 * none. Tapping it opens the note writing screen.
 */
function NotePreview({ notes, onPress }: { notes: string; onPress: () => void }) {
  const empty = !notes.trim();
  return (
    <YStack
      role="button"
      accessible
      aria-label={empty ? 'Write a note for next time' : `Note: ${notes}`}
      onPress={onPress}
      paddingHorizontal="$3"
      paddingVertical="$3"
      borderRadius="$3"
      backgroundColor={{ default: '$color2', press: '$color3' }}>
      <AppText color={empty ? '$color9' : '$color'} numberOfLines={3}>
        {empty ? 'Grip, seat height, how it felt…' : notes}
      </AppText>
    </YStack>
  );
}

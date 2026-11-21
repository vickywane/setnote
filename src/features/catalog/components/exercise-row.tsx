import { Image } from 'expo-image';
import { XStack, YStack } from 'tamagui';

import { AppText } from '@/components/ds/text';
import { EXERCISE_ICONS, iconForExercise } from '@/lib/exercise-icons';
import { palette } from '@/theme/tamagui.config';

/**
 * Figma "Exercise icon tile": the exercise's icon (Exercise icons library, 24 grid) in a 40pt
 * rounded tile. User-created exercises fall back to exercise/custom.
 */
export function ExerciseIconTile({ name }: { name: string }) {
  return (
    <XStack
      width={40}
      height={40}
      borderRadius="$3"
      backgroundColor="$color3"
      alignItems="center"
      justifyContent="center">
      <Image
        source={EXERCISE_ICONS[iconForExercise(name)]}
        style={{ width: 24, height: 24 }}
        tintColor={palette.color12}
        contentFit="contain"
        accessible={false}
      />
    </XStack>
  );
}

/**
 * One exercise in the Add exercise sheet: icon tile, name and a caption (equipment ·
 * body part · when you last did it). Tapping the row adds the exercise.
 */
export function ExerciseRow({
  name,
  meta,
  onAdd,
  disabled,
}: {
  name: string;
  meta: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <XStack
      role="button"
      accessible
      aria-label={`Add ${name}. ${meta}`}
      aria-disabled={disabled}
      onPress={disabled ? undefined : onAdd}
      gap="$3"
      alignItems="center"
      paddingVertical={10}
      borderBottomWidth={1}
      borderColor="$borderColor"
      opacity={{ default: 1, press: 0.6 }}>
      <ExerciseIconTile name={name} />
      <YStack flex={1} gap={1}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="$color9" numberOfLines={1}>
          {meta}
        </AppText>
      </YStack>
    </XStack>
  );
}

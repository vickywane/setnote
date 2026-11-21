import {
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';

import { Icon } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';
import { dayAccessibilityLabel, dayState, mondayOf } from '@/features/home/weeks';

/** The home screen's side gutter; the strip bleeds through it so the day before peeks in. */
const GUTTER = 16;
/** How much of the day before this Monday shows at the left edge. */
const PEEK = 16;
const TILE = 40;
/** Never let tiles touch, however narrow the screen. */
const MIN_GAP = 4;
/** A day's check pops in when it's first trained while you watch (not when the strip loads). */
const CHECK_IN = ZoomIn.springify().damping(12).stiffness(220);

export type WeekStripHandle = {
  /** Scroll back so this week (and today) is in view. */
  scrollToToday: () => void;
};

type Props = {
  /** Every day on the strip, newest first: this week's Sunday back to the Monday of the first week. */
  days: readonly number[];
  trained: ReadonlySet<number>;
  /** Local midnight today. */
  today: number;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  /** Monday of the week in the middle of the strip, as it scrolls. */
  onWeekChange: (monday: number) => void;
  ref?: Ref<WeekStripHandle>;
};

/**
 * "This week": one row of days that scrolls back to the week the account started. It opens on
 * this week, Monday to Sunday, with the day before peeking in from the left edge to show
 * there's more. Scrolling is free but short (fast deceleration, settling on whole days), so a
 * flick moves days rather than months and today is one tap away ("This week").
 *
 * Inverted, so the newest day starts in view at the right and older days are only rendered as
 * they're reached. Every cell is the same width, so positions are simple arithmetic.
 */
export function WeekStrip({
  days,
  trained,
  today,
  selectedDay,
  onSelectDay,
  onWeekChange,
  ref,
}: Props) {
  const listRef = useRef<FlatList<number>>(null);
  const [width, setWidth] = useState(0);
  const offset = useRef(0);
  const week = useRef<number | null>(null);

  // Seven tiles between the peek and the right gutter; each cell is a gap then a tile.
  const gap = Math.max((width - GUTTER - PEEK - 7 * TILE) / 7, MIN_GAP);
  const slot = TILE + gap;

  // With Reduce Motion on, jump to today instead of scrolling there.
  const reduceMotion = useReducedMotion();
  useImperativeHandle(
    ref,
    () => ({
      scrollToToday: () => listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion }),
    }),
    [reduceMotion],
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);

  // Rotation or a resized window: keep the same day at the right edge.
  const previousSlot = useRef(slot);
  useEffect(() => {
    const before = previousSlot.current;
    previousSlot.current = slot;
    if (offset.current === 0 || before === slot || width === 0) return;
    const next = (offset.current / before) * slot;
    offset.current = next;
    listRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [slot, width]);

  // A new week started while the app was open: its days are added at the right. Keep showing
  // the days that were in view, unless the strip was on today, which should stay in view.
  const newest = days[0];
  const previousNewest = useRef(newest);
  useEffect(() => {
    const added = days.indexOf(previousNewest.current);
    previousNewest.current = newest;
    if (added <= 0 || offset.current === 0 || width === 0) return;
    const next = offset.current + added * slot;
    offset.current = next;
    listRef.current?.scrollToOffset({ offset: next, animated: false });
  }, [newest, days, slot, width]);

  const reportWeek = useCallback(
    (x: number) => {
      if (width === 0 || days.length === 0) return;
      // Distance from the right edge to the middle of the strip, in days.
      const index = Math.floor((x + width / 2 - GUTTER) / slot);
      const monday = mondayOf(days[Math.max(0, Math.min(index, days.length - 1))]);
      if (monday === week.current) return;
      week.current = monday;
      onWeekChange(monday);
    },
    [width, slot, days, onWeekChange],
  );

  // The week in view on first layout, and whenever the days change under it.
  useEffect(() => reportWeek(offset.current), [reportWeek]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.x;
      reportWeek(offset.current);
    },
    [reportWeek],
  );

  const renderItem = useCallback<ListRenderItem<number>>(
    ({ item: day }) => {
      const state = dayState(day, trained, today);
      return (
        <DayCell
          day={day}
          letter={state.letter}
          done={state.done}
          isToday={state.today}
          disabled={state.disabled}
          selected={day === selectedDay}
          gap={gap}
          onSelectDay={onSelectDay}
        />
      );
    },
    [trained, today, selectedDay, gap, onSelectDay],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: slot, offset: GUTTER + slot * index, index }),
    [slot],
  );

  return (
    <View testID="week-strip" style={{ marginHorizontal: -GUTTER }} onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={days}
          horizontal
          inverted
          keyExtractor={String}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          extraData={renderItem}
          // Inverted: this padding is on the right, keeping Sunday off the screen edge.
          contentContainerStyle={{ paddingLeft: GUTTER }}
          snapToInterval={slot}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          initialNumToRender={10}
          maxToRenderPerBatch={14}
          windowSize={5}
        />
      ) : (
        // Measuring the width; hold the strip's height so nothing jumps.
        <YStack height={TILE + 6 + 17 + 6} />
      )}
    </View>
  );
}

const DayCell = memo(function DayCell({
  day,
  letter,
  done,
  isToday,
  disabled,
  selected,
  gap,
  onSelectDay,
}: {
  day: number;
  letter: string;
  done: boolean;
  isToday: boolean;
  disabled: boolean;
  selected: boolean;
  gap: number;
  onSelectDay: (day: number) => void;
}) {
  const ink = done && isToday;
  // Done already when this cell appeared: show the check without animating it.
  const [doneAtMount] = useState(done);
  return (
    <YStack
      paddingLeft={gap}
      gap={6}
      alignItems="center"
      role="button"
      accessible
      aria-label={dayAccessibilityLabel({ day, letter, done, today: isToday, disabled }, selected)}
      aria-selected={selected}
      aria-disabled={disabled}
      onPress={disabled ? undefined : () => onSelectDay(day)}
      opacity={disabled ? 1 : { default: 1, press: 0.6 }}
      hitSlop={{ top: 6, bottom: 6 }}>
      <XStack
        width={TILE}
        height={TILE}
        borderRadius="$3"
        alignItems="center"
        justifyContent="center"
        backgroundColor={done ? (ink ? '$color12' : '$color3') : 'transparent'}
        borderWidth={selected ? 2 : done ? 0 : 1}
        borderStyle={selected || done ? 'solid' : 'dashed'}
        borderColor={selected ? '$color12' : '$borderColor'}>
        {done && (
          <Animated.View entering={doneAtMount ? undefined : CHECK_IN}>
            <Icon name="check" size={18} color={ink ? 'color1' : 'color12'} />
          </Animated.View>
        )}
      </XStack>
      <AppText
        variant="caption"
        color={isToday || selected ? '$color' : '$color9'}
        fontWeight={selected ? '600' : undefined}>
        {letter}
      </AppText>
      {/* Under the selected day; always there so selecting doesn't shift the row. */}
      <YStack
        width={4}
        height={4}
        marginTop={-2}
        borderRadius="$round"
        backgroundColor={selected ? '$color12' : 'transparent'}
      />
    </YStack>
  );
});

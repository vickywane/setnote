import { forwardRef, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Segment } from '@/features/notes/highlight';
import { palette } from '@/theme/tamagui.config';

/**
 * Figma "Paper": a rule under every line and a vermilion margin rule at 44pt. Lines are 34pt
 * and each rule sits at the foot of its line, so the iOS cursor (as tall as the line) stays
 * between two rules instead of crossing one.
 */
const RULE_SPACING = 34;
const TEXT_TOP = 6;
const FIRST_RULE = TEXT_TOP + RULE_SPACING;
const MARGIN_X = 44;
const TEXT_LEFT = 56;
const MIN_RULES = 19;
/** A note is one page: at most this many lines, wrapped lines included. */
export const MAX_NOTE_LINES = 35;
const MAX_TEXT_HEIGHT = MAX_NOTE_LINES * RULE_SPACING;

/** Keeps the first `max` lines of a paste that has more line breaks than a page holds. */
export function keepLines(text: string, max = MAX_NOTE_LINES) {
  const lines = text.split('\n');
  return lines.length > max ? lines.slice(0, max).join('\n') : text;
}

/**
 * Cuts text that runs past the page back towards what fits: in proportion to how far it runs
 * over (`fits` = page height / text height), at a word break, never shorter than the text that
 * last fitted. Called again after each layout until it fits.
 */
export function cutToFit(text: string, lastFitLength: number, fits: number) {
  let cut = text.slice(0, Math.max(lastFitLength, Math.floor(text.length * fits) - 1));
  const wordBreak = cut.search(/\s\S*$/);
  if (wordBreak > lastFitLength) cut = cut.slice(0, wordBreak);
  return cut;
}

type NotePaperProps = {
  segments: Segment[];
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  editable?: boolean;
  accessibilityLabel: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

/**
 * Lined paper with a margin rule and the user's own words in Newsreader 19/30. What the parser
 * understood gets a dotted vermilion underline in place, while you type.
 */
export const NotePaper = forwardRef<TextInput, NotePaperProps>(function NotePaper(
  {
    segments,
    onChangeText,
    placeholder,
    autoFocus,
    editable = true,
    accessibilityLabel,
    onFocus,
    onBlur,
  },
  ref,
) {
  const [height, setHeight] = useState(0);
  const rules = Math.min(
    MAX_NOTE_LINES,
    Math.max(MIN_RULES, Math.ceil((height + 8) / RULE_SPACING) + 1),
  );
  const text = segments.map((s) => s.text).join('');
  const empty = text === '';
  // The last text that fit on the page, to undo an edit that runs past the last line.
  const lastFit = useRef(text);
  const edited = useRef(false);
  // Set while a paste that ran past the page is being cut back to what fits.
  const trimming = useRef(false);

  const changeText = (next: string) => {
    // Quick check before layout: more line breaks than lines can never fit, so keep the lines
    // that can (a pasted workout keeps its first page instead of being dropped).
    if (next.length > text.length) {
      const kept = keepLines(next);
      if (kept !== next) {
        next = kept;
        trimming.current = true;
      }
    }
    edited.current = true;
    onChangeText(next);
  };

  return (
    <View style={styles.paper}>
      {Array.from({ length: rules }, (_, i) => (
        <View
          key={i}
          style={[styles.rule, { top: FIRST_RULE + i * RULE_SPACING }]}
          pointerEvents="none"
        />
      ))}
      <View
        style={[styles.margin, { height: FIRST_RULE + rules * RULE_SPACING }]}
        pointerEvents="none"
      />
      <TextInput
        ref={ref}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
        scrollEnabled={false}
        editable={editable}
        autoFocus={autoFocus}
        onChangeText={changeText}
        onContentSizeChange={(e) => {
          const contentHeight = e.nativeEvent.contentSize.height;
          const overflows = contentHeight - TEXT_TOP > MAX_TEXT_HEIGHT;
          // Only the user's own edit is cut back; a note saved longer than a page opens whole.
          if (overflows && edited.current && text.length > lastFit.current.length) {
            // Keep what fits: cut the text in proportion to how far it runs over, at a word
            // break. The next layout checks again, so a few passes settle on the page.
            const cut = cutToFit(
              text,
              lastFit.current.length,
              MAX_TEXT_HEIGHT / (contentHeight - TEXT_TOP),
            );
            trimming.current = true;
            onChangeText(cut);
            return;
          }
          if (!overflows) {
            lastFit.current = text;
            edited.current = false;
            if (trimming.current) {
              trimming.current = false;
              Alert.alert(
                'That’s more than a page',
                'A note is one page, so what fits was kept. Start another note for the rest.',
              );
            }
          }
          setHeight(contentHeight);
        }}
        placeholder={placeholder}
        placeholderTextColor={palette.color8}
        selectionColor={palette.color12}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, { minHeight: FIRST_RULE + (rules - 1) * RULE_SPACING }]}>
        {empty
          ? null
          : segments.map((segment, i) => (
              <Text
                key={i}
                style={
                  segment.pending ? styles.pending : segment.picked ? styles.picked : undefined
                }>
                {segment.text}
              </Text>
            ))}
      </TextInput>
    </View>
  );
});

const styles = StyleSheet.create({
  paper: {
    position: 'relative',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: palette.color4,
  },
  margin: {
    position: 'absolute',
    top: 0,
    left: MARGIN_X,
    width: 1,
    backgroundColor: palette.accent4,
  },
  input: {
    marginLeft: TEXT_LEFT,
    marginRight: 20,
    paddingTop: TEXT_TOP,
    paddingBottom: 0,
    paddingHorizontal: 0,
    fontFamily: 'Newsreader-Regular',
    fontSize: 19,
    lineHeight: RULE_SPACING,
    color: palette.color12,
    textAlignVertical: 'top',
  },
  pending: {
    color: palette.color8,
  },
  picked: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: palette.accent9,
  },
});

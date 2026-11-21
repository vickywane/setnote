import { styled, Text } from 'tamagui';

/**
 * Line heights are pixel strings: Tamagui v3 treats a unitless lineHeight as a multiple of
 * the font size (like CSS), so `20` would mean 20× rather than 20pt.
 *
 * Type ramp: the "v2/…" text styles in Figma. Newsreader for titles, dates and the user's own
 * words, Geist for UI, Geist Mono for every number. Use `variant` rather than ad-hoc sizes.
 */
export const AppText = styled(Text, {
  name: 'AppText',
  fontFamily: '$body',
  color: '$color',
  variants: {
    variant: {
      // v2/Display: Newsreader Medium 34/38, -0.6
      display: {
        fontFamily: '$heading',
        fontSize: 34,
        lineHeight: '38px',
        fontWeight: '500',
        letterSpacing: -0.6,
      },
      // v2/Title: Newsreader Medium 24/30, -0.3
      title: {
        fontFamily: '$heading',
        fontSize: 24,
        lineHeight: '30px',
        fontWeight: '500',
        letterSpacing: -0.3,
      },
      // v2/Note: Newsreader Regular 19/30, the user's handwriting on lined paper
      note: { fontFamily: '$heading', fontSize: 19, lineHeight: '30px', fontWeight: '400' },
      // History and recent notes: Newsreader Regular 17/24
      noteEntry: { fontFamily: '$heading', fontSize: 17, lineHeight: '24px', fontWeight: '400' },
      // v2/Heading: Geist SemiBold 17/22, -0.2
      heading: { fontSize: 17, lineHeight: '22px', fontWeight: '600', letterSpacing: -0.2 },
      // v2/Body: Geist Regular 16/23
      body: { fontSize: 16, lineHeight: '23px', fontWeight: '400' },
      // v2/Body strong: Geist Medium 16/23
      bodyStrong: { fontSize: 16, lineHeight: '23px', fontWeight: '500' },
      // v2/Label: Geist Medium 14/19
      label: { fontSize: 14, lineHeight: '19px', fontWeight: '500' },
      // v2/Caption: Geist Regular 13/17
      caption: { fontSize: 13, lineHeight: '17px', fontWeight: '400' },
      // v2/Overline: Geist Mono Medium 11/14, +0.8
      overline: {
        fontFamily: '$mono',
        fontSize: 11,
        lineHeight: '14px',
        fontWeight: '500',
        letterSpacing: 0.8,
        color: '$color9',
      },
      // v2/Numeral L: Geist Mono Medium 24/28, -0.6
      numeralL: {
        fontFamily: '$mono',
        fontSize: 24,
        lineHeight: '28px',
        fontWeight: '500',
        letterSpacing: -0.6,
      },
      // v2/Numeral M: Geist Mono Regular 15/20, -0.2
      numeralM: {
        fontFamily: '$mono',
        fontSize: 15,
        lineHeight: '20px',
        fontWeight: '400',
        letterSpacing: -0.2,
      },
      // Stepper value: Geist Mono Medium 40/44, -0.6
      numeralXL: {
        fontFamily: '$mono',
        fontSize: 40,
        lineHeight: '44px',
        fontWeight: '500',
        letterSpacing: -0.6,
      },
    },
  } as const,
  defaultVariants: {
    variant: 'body',
  },
});

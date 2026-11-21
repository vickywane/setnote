import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * How much of the bottom of the screen the keyboard covers while it's up, for content pinned
 * to the bottom of the screen (or of a native form sheet, which is anchored there too).
 * KeyboardAvoidingView and measureInWindow measure against the sheet rather than the screen,
 * so they get this wrong.
 *
 * On iOS this follows the keyboard's frame, so it also counts a hardware keyboard's input
 * accessory bar, which shows without a keyboard-show event.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      const change = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
        const screen = Dimensions.get('screen').height;
        setHeight(Math.max(0, screen - event.endCoordinates.screenY));
      });
      const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
      return () => {
        change.remove();
        hide.remove();
      };
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';

import { Icon } from '@/components/ds/icon';
import { AppText } from '@/components/ds/text';
import { feedback } from '@/lib/feedback';
import { TABS } from '@/navigation/tabs';

/** Height of the tab items above the home indicator (Figma "Tab bar" is 84 = 50 + 34). */
export const TAB_BAR_HEIGHT = 50;

export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Figma "Tab bar": white, a hairline on top, four items. The active item is ink with a
 * SemiBold label; the others are color9.
 */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <YStack
      role="tablist"
      backgroundColor="$background"
      borderTopWidth={1}
      borderColor="$borderColor"
      paddingBottom={insets.bottom}>
      <XStack height={TAB_BAR_HEIGHT} paddingTop="$2" paddingHorizontal="$3">
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              feedback.select();
              navigation.navigate(route.name);
            }
          };
          return (
            <YStack
              key={route.key}
              role="tab"
              accessible
              aria-label={tab.label}
              aria-selected={focused}
              onPress={onPress}
              flex={1}
              gap={3}
              alignItems="center"
              opacity={{ default: 1, press: 0.6 }}>
              <Icon name={tab.icon} size={24} color={focused ? 'color12' : 'color9'} />
              <AppText
                variant="caption"
                fontWeight={focused ? '600' : '400'}
                color={focused ? '$color' : '$color9'}>
                {tab.label}
              </AppText>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

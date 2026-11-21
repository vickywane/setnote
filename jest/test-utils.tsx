import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import { tamaguiConfig } from '@/theme/tamagui.config';

/** Fresh React Query client per test (no retries) inside the app's Tamagui theme. */
export function QueryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  return (
    <QueryClientProvider client={client}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </QueryClientProvider>
  );
}

import { onlineManager, useMutationState } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Whether the device has a connection, as TanStack Query sees it (see `listenToConnectivity`). */
export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** How many saves are waiting for a connection. */
export function usePausedSaveCount() {
  return useMutationState({
    filters: { status: 'pending', predicate: (mutation) => mutation.state.isPaused },
    select: () => 1,
  }).length;
}

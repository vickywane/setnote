import { useState } from 'react';

/**
 * Pull-to-refresh state for a RefreshControl. The spinner shows only while a refresh the user
 * pulled is running, not during background refetches (after saving, or on reconnect): on iOS,
 * turning `refreshing` on without a pull leaves the spinner's gap stuck above the content.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}

import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

/** How long Undo stays on screen. */
export const UNDO_MS = 5_000;
/** Longer with a screen reader on: reaching the toast takes a few swipes. */
export const UNDO_SCREEN_READER_MS = 12_000;

export type Removal = {
  /** Shown in the toast: "Bench press removed". */
  message: string;
  /** Rows hidden from the screen until the removal is committed or undone. */
  ids: string[];
  /** Deletes for real. Should resolve once the screen's data no longer has the rows. */
  commit: () => Promise<unknown>;
  /** The delete failed; the rows are back on screen. */
  onError?: (error: Error) => void;
};

type UndoStore = {
  /** The removal the toast offers to undo. */
  /** `durationMs`: how long Undo stays available, for the toast's countdown. */
  pending: (Removal & { key: number; durationMs: number }) | null;
  /** Every row waiting to be deleted, including removals already committing. */
  hidden: string[];
  remove: (removal: Removal) => void;
  undo: () => void;
  /** Commits the pending removal now, e.g. when another one replaces it. */
  flush: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let nextKey = 1;
let screenReader = false;
AccessibilityInfo.isScreenReaderEnabled?.()
  .then((on) => (screenReader = on))
  .catch(() => {});
AccessibilityInfo.addEventListener?.('screenReaderChanged', (on: boolean) => (screenReader = on));

const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};

/**
 * Delete with Undo instead of a confirmation: the rows disappear at once, a toast offers Undo
 * for a few seconds, and only then is the delete sent. The timer lives here rather than on a
 * screen, so leaving the screen still deletes; if the app is killed first, nothing is lost.
 */
export const useUndoStore = create<UndoStore>()((set, get) => {
  const commit = (removal: Removal) => {
    const unhide = () =>
      set((state) => ({ hidden: state.hidden.filter((id) => !removal.ids.includes(id)) }));
    removal
      .commit()
      .then(unhide)
      .catch((error: unknown) => {
        unhide();
        removal.onError?.(error instanceof Error ? error : new Error(String(error)));
      });
  };

  return {
    pending: null,
    hidden: [],
    remove: (removal) => {
      get().flush();
      const key = nextKey++;
      const durationMs = screenReader ? UNDO_SCREEN_READER_MS : UNDO_MS;
      set((state) => ({
        pending: { ...removal, key, durationMs },
        hidden: [...state.hidden, ...removal.ids],
      }));
      timer = setTimeout(() => get().flush(), durationMs);
    },
    undo: () => {
      const { pending } = get();
      if (!pending) return;
      clearTimer();
      set((state) => ({
        pending: null,
        hidden: state.hidden.filter((id) => !pending.ids.includes(id)),
      }));
    },
    flush: () => {
      const { pending } = get();
      clearTimer();
      if (!pending) return;
      set({ pending: null });
      commit(pending);
    },
  };
});

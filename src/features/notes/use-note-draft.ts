import { useCallback, useEffect, useRef, useState } from 'react';

const AUTOSAVE_DELAY_MS = 800;
/** Re-read the note once typing pauses; the peek shows "Reading your note…" until then. */
const DETECT_DELAY_MS = 600;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Text being written on the note screen: saves shortly after typing stops and when leaving,
 * queues saves so they land in order, and never saves empty text. Leaving with nothing
 * written calls `onLeaveEmpty` instead (delete the note, clear the exercise note).
 */
export function useNoteDraft({
  initial,
  ready,
  save,
  onLeaveEmpty,
}: {
  /** Saved text, once loaded. */
  initial: string | undefined;
  /** False while the saved text is loading. */
  ready: boolean;
  save: (text: string) => Promise<void>;
  onLeaveEmpty: () => void;
}) {
  const [body, setBody] = useState('');
  const [detected, setDetected] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Take the saved text once it's loaded.
  if (ready && !loaded) {
    setLoaded(true);
    setBody(initial ?? '');
    setDetected(initial ?? '');
  }

  const lastSaved = useRef<string | null>(null);
  const queue = useRef(Promise.resolve());
  const saveRef = useRef(save);
  const leaveRef = useRef(onLeaveEmpty);
  const bodyRef = useRef(body);
  const left = useRef(false);
  useEffect(() => {
    saveRef.current = save;
    leaveRef.current = onLeaveEmpty;
    bodyRef.current = body;
  });
  useEffect(() => {
    if (loaded && lastSaved.current === null) lastSaved.current = initial ?? '';
  }, [loaded, initial]);

  const flush = useCallback((text: string) => {
    queue.current = queue.current.then(async () => {
      if (left.current && !text.trim()) return;
      if (!text.trim() || text === lastSaved.current) return;
      setSaveState('saving');
      try {
        await saveRef.current(text);
        lastSaved.current = text;
        setSaveState('saved');
        setError(null);
      } catch (e) {
        setSaveState('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    return queue.current;
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => void flush(body), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [body, loaded, flush]);

  useEffect(() => {
    const timer = setTimeout(() => setDetected(body), DETECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [body]);

  // Leaving: save what's written, or drop an empty note.
  useEffect(
    () => () => {
      const text = bodyRef.current;
      if (text.trim()) {
        void flush(text);
      } else {
        left.current = true;
        void queue.current.then(() => leaveRef.current());
      }
    },
    [flush],
  );

  return {
    body,
    setBody,
    /** The text the summary was last read from; differs from `body` while typing. */
    detected,
    loaded,
    saveState,
    error,
    retry: () => void flush(bodyRef.current),
    /** Sets the text and saves it straight away, e.g. so a new note has an id to attach to. */
    saveNow: (text: string) => {
      setBody(text);
      return flush(text);
    },
  };
}

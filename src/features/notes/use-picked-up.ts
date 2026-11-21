import { useMemo, useState } from 'react';

import type { PeekState, PickedExercise } from '@/features/notes/components/picked-up';
import { applyAnswer, pickedQuestion, type Question } from '@/features/notes/picked-up';
import type { CatalogEntry, ExtractedNote } from '@/lib/extraction/parse-note';

type Answer = { index: number; kind: Question['kind']; value: string };

/**
 * What the note screen's "Picked up" peek and sheet show: the parsed exercises with answers
 * applied, the next question for each, and the peek's state.
 */
export function usePickedUp({
  extracted,
  catalog,
  hasText,
  detecting,
  refining = false,
}: {
  extracted: ExtractedNote;
  catalog: readonly CatalogEntry[];
  hasText: boolean;
  detecting: boolean;
  /** Claude is still reading the note; what's shown is the on-device parse for now. */
  refining?: boolean;
}) {
  const [answers, setAnswers] = useState<Answer[]>([]);

  const items: PickedExercise[] = useMemo(
    () =>
      extracted.exercises.map((original, index) => {
        const mine = answers.filter((a) => a.index === index);
        const exercise = mine.reduce((e, a) => applyAnswer(e, a.kind, a.value), original);
        const question = pickedQuestion(exercise, catalog);
        const answered = question && mine.some((a) => a.kind === question.kind);
        return { exercise, question: answered ? null : question };
      }),
    [extracted, catalog, answers],
  );

  const peek: PeekState = !hasText
    ? { kind: 'empty' }
    : detecting
      ? { kind: 'detecting' }
      : items.length === 0
        ? { kind: 'nothing' }
        : {
            kind: 'ready',
            names: items.map((i) => i.exercise.name),
            questions: items.filter((i) => i.question).length,
            refining,
          };

  return {
    items,
    peek,
    /** The parse with answers applied, to save with the note. */
    reviewed: { ...extracted, exercises: items.map((i) => i.exercise) } as ExtractedNote,
    answer: (index: number, question: Question, value: string) =>
      setAnswers((list) => [...list, { index, kind: question.kind, value }]),
  };
}

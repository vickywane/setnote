import { render, screen } from '@testing-library/react-native';

import { NoteDetailsCard } from '@/features/notes/components/note-details-card';
import { parseNote } from '@/lib/extraction/parse-note';

import { QueryWrapper } from '../jest/test-utils';

const CATALOG = [
  {
    id: 'curl',
    name: 'Bicep curl',
    equipment: ['dumbbell'],
    aliases: ['curl', 'arm curl'],
  },
];

const ARM_CURL =
  'Arm Curl - 32kg… 10\n' +
  'Struggled with it from the start… after 3 sets, had to break into 5 reps per go… ' +
  'should be able to drive it 10reps per set';

describe('NoteDetailsCard', () => {
  it('asks for an exercise when the note is empty', async () => {
    await render(<NoteDetailsCard state="empty" hasText={false} exercises={[]} status={null} />, {
      wrapper: QueryWrapper,
    });
    expect(screen.getByText('Nothing to show yet')).toBeVisible();
    expect(screen.queryByText('SAVED')).toBeNull();
  });

  it('says nothing was found when the note has text but no exercises', async () => {
    await render(<NoteDetailsCard state="empty" hasText exercises={[]} status={null} />, {
      wrapper: QueryWrapper,
    });
    expect(screen.getByText(/No exercises found yet/)).toBeVisible();
  });

  it('shows a detecting chip while the note is read', async () => {
    await render(
      <NoteDetailsCard
        state="detecting"
        hasText
        exercises={[]}
        status={{ label: 'SAVED', tone: 'success' }}
      />,
      { wrapper: QueryWrapper },
    );
    expect(screen.getByText('DETECTING')).toBeVisible();
    expect(screen.getByText('Reading your note…')).toBeVisible();
    expect(screen.queryByText('SAVED')).toBeNull();
  });

  it('shows what was read from the note', async () => {
    const { exercises } = parseNote(ARM_CURL, CATALOG);
    await render(
      <NoteDetailsCard
        state="ready"
        hasText
        exercises={exercises}
        status={{ label: 'SAVED', tone: 'success' }}
      />,
      { wrapper: QueryWrapper },
    );
    expect(screen.getByText('Bicep curl')).toBeVisible();
    expect(screen.getByText('Equipment not stated')).toBeVisible();
    expect(screen.getByText('32')).toBeVisible();
    expect(screen.getByText('Hard')).toBeVisible();
    expect(screen.getByText('3 sets found')).toBeVisible();
    expect(screen.getByText('3 × 10')).toBeVisible();
    expect(
      screen.getByText('Clusters of 5 reps. Next time: 10 reps per set at 32 kg.'),
    ).toBeVisible();
    expect(screen.getByText('SAVED')).toBeVisible();
  });
});

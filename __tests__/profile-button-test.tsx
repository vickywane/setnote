import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileButton } from '@/features/home/profile-button';

import { QueryWrapper } from '../jest/test-utils';

describe('ProfileButton', () => {
  it('shows the first letter of a signed-in email', async () => {
    const onPress = jest.fn();
    await render(<ProfileButton email="vicky@example.com" onPress={onPress} />, {
      wrapper: QueryWrapper,
    });
    expect(screen.getByText('V')).toBeVisible();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Account, signed in as vicky@example.com' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a person for a guest, or an account with no email', async () => {
    await render(<ProfileButton email={null} onPress={jest.fn()} />, { wrapper: QueryWrapper });
    expect(screen.getByRole('button', { name: 'Account, using as a guest' })).toBeVisible();
    await render(<ProfileButton email="   " onPress={jest.fn()} />, { wrapper: QueryWrapper });
    expect(screen.getByRole('button', { name: 'Account, using as a guest' })).toBeVisible();
  });
});

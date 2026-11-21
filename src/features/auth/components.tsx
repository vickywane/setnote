import { forwardRef, useState } from 'react';
import { Alert, TextInput, type TextInputProps } from 'react-native';
import { XStack, YStack } from 'tamagui';

import { Button } from '@/components/ds/controls';
import { BottomSheet } from '@/components/ds/sheet';
import { AppText } from '@/components/ds/text';
import { createAccount, deleteAccount, signIn } from '@/features/auth/account';
import { palette } from '@/theme/tamagui.config';

const MIN_PASSWORD_LENGTH = 8;

export type AccountMode = 'create' | 'signin';

type LeaveGuestChoice = 'sign-in' | 'add-email' | 'cancel';

/**
 * Signing in leaves the guest account behind, and with it what was logged as the guest. Say so
 * before it happens and offer to keep it instead.
 */
function confirmLeaveGuest(guestData: string) {
  return new Promise<LeaveGuestChoice>((resolve) =>
    Alert.alert(
      'Leave your guest data behind?',
      `Your ${guestData} stay with this guest account. After signing in you won’t be able to open them. To keep them, add an email to this guest instead.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
        { text: 'Add an email instead', onPress: () => resolve('add-email') },
        { text: 'Sign in anyway', style: 'destructive', onPress: () => resolve('sign-in') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancel') },
    ),
  );
}

/**
 * Figma "Sheet · Keep your workouts" (create) and "Sheet · Sign in". Creating an account adds an
 * email to the guest, so everything logged stays; signing in switches the phone to that account.
 */
export function AccountSheet({
  mode,
  onModeChange,
  open,
  onClose,
  guestData,
}: {
  mode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
  open: boolean;
  onClose: () => void;
  /** What the current guest has logged ("3 sessions and 2 notes"), or null if nothing. */
  guestData?: string | null;
}) {
  const create = mode === 'create';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();
  const canSubmit = /^\S+@\S+\.\S+$/.test(trimmedEmail) && password.length >= MIN_PASSWORD_LENGTH;

  const reset = () => {
    setPassword('');
    setError(null);
    setConfirmSent(false);
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (create) {
        const result = await createAccount(trimmedEmail, password);
        if (result === 'confirm-email') {
          setConfirmSent(true);
          return;
        }
      } else {
        if (guestData) {
          const choice = await confirmLeaveGuest(guestData);
          if (choice === 'cancel') return;
          if (choice === 'add-email') {
            onModeChange('create');
            return;
          }
        }
        await signIn(trimmedEmail, password);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        onClosed={reset}
        title="Check your email"
        designHeight={300}>
        <AppText color="$colorMuted">
          We sent a link to {trimmedEmail}. Open it on this phone to finish adding your email. Your
          workouts stay saved in the meantime.
        </AppText>
        <Button label="Done" onPress={onClose} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={reset}
      title={create ? 'Keep your workouts' : 'Sign in'}
      designHeight={520}>
      <AppText color="$colorMuted">
        {create
          ? 'Everything you’ve logged so far moves to this account. Nothing to re-enter.'
          : 'Signing in switches this phone to your account. What you logged as a guest stays with the guest and isn’t merged.'}
      </AppText>
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder={create ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
        secureTextEntry
        autoComplete={create ? 'new-password' : 'current-password'}
        textContentType={create ? 'newPassword' : 'password'}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      {error && (
        <AppText variant="caption" color="$red9">
          {error}
        </AppText>
      )}
      <Button
        label={create ? 'Create account' : 'Sign in'}
        disabled={!canSubmit}
        loading={busy}
        onPress={() => void submit()}
      />
      <XStack
        role="button"
        accessible
        justifyContent="center"
        onPress={() => {
          setError(null);
          onModeChange(create ? 'signin' : 'create');
        }}
        opacity={{ default: 1, press: 0.6 }}>
        <AppText variant="label" color="$colorMuted" textAlign="center">
          {create ? 'Already have an account? Sign in instead' : 'New here? Add an email instead'}
        </AppText>
      </XStack>
    </BottomSheet>
  );
}

/**
 * Figma "Sheet · Delete everything?". Deleting removes the user and, through cascades, every
 * session, note and custom exercise.
 */
export function DeleteDataSheet({
  guest,
  summary,
  open,
  onClose,
}: {
  guest: boolean;
  /** "14 sessions, 6 notes and 2 custom exercises" */
  summary: string;
  open: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      onClosed={() => setError(null)}
      title={guest ? 'Delete everything?' : 'Delete your account?'}
      designHeight={360}>
      <AppText color="$colorMuted">
        This removes {guest ? '' : 'your account, '}
        {summary} from this phone and our servers. It can’t be undone.
      </AppText>
      {error && (
        <AppText variant="caption" color="$red9">
          {error}
        </AppText>
      )}
      <Button
        kind="destructive"
        label={guest ? 'Delete everything' : 'Delete account'}
        loading={busy}
        onPress={() => void remove()}
      />
      <Button
        kind="ghost"
        label={guest ? 'Keep my data' : 'Keep my account'}
        disabled={busy}
        onPress={onClose}
      />
    </BottomSheet>
  );
}

/** Figma form field: Geist Medium label over a 52pt color2 input with a hairline border. */
const FormField = forwardRef<TextInput, TextInputProps & { label: string }>(function FormField(
  { label, ...props },
  ref,
) {
  return (
    <YStack gap={6}>
      <AppText variant="label" color="$colorMuted">
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={palette.color9}
        selectionColor={palette.color12}
        style={{
          height: 52,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.color5,
          backgroundColor: palette.color2,
          fontFamily: 'Geist-Regular',
          fontSize: 16,
          color: palette.color12,
        }}
        {...props}
      />
    </YStack>
  );
});

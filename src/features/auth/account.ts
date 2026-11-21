import { FunctionsHttpError } from '@supabase/supabase-js';

import { removeAllNoteAudio } from '@/features/notes/recordings';
import { removeAllVideos, removeDeviceVideos } from '@/features/recovery/videos';
import { supabase } from '@/lib/supabase';

export type CreateAccountResult = 'created' | 'confirm-email';

/**
 * Turns the current guest into a permanent account. The user id stays the same, so all
 * of the guest's sessions and notes stay with the account.
 *
 * Supabase sets the email first and the password second. If the project requires email
 * confirmation, the email is pending until the user taps the link we send.
 */
export async function createAccount(email: string, password: string): Promise<CreateAccountResult> {
  const withEmail = await supabase.auth.updateUser({ email });
  if (withEmail.error) throw withEmail.error;

  if (withEmail.data.user.email !== email) {
    return 'confirm-email';
  }

  const withPassword = await supabase.auth.updateUser({ password });
  if (withPassword.error) throw withPassword.error;
  return 'created';
}

/**
 * Signs in to an existing account. This replaces the current guest session; anything
 * logged as that guest stays with the guest user and is not merged.
 */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Deletes the user and all of their data. The `delete-account` Edge Function does it on the
 * server (storage files, then the user, whose tables cascade), so closing the app halfway
 * can't leave files behind. Check videos kept only on this phone are removed here.
 *
 * Without that function deployed, falls back to removing files from the app and then calling
 * the `delete_my_account` database function.
 */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    if (!(error instanceof FunctionsHttpError) || error.context?.status !== 404) {
      throw new Error(await functionErrorMessage(error));
    }
    await removeAllNoteAudio();
    await removeAllVideos();
    const rpc = await supabase.rpc('delete_my_account');
    if (rpc.error) throw rpc.error;
  } else {
    removeDeviceVideos();
  }
  // The server-side user is gone; clear the local session too.
  await supabase.auth.signOut({ scope: 'local' });
}

/** The message the function returned, if any, else the client's. */
async function functionErrorMessage(error: Error) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // Not JSON.
    }
  }
  return error.message;
}

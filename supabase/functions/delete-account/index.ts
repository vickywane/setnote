// Deletes the calling user and everything they own, on the server, so nothing is left behind
// if the app is closed halfway through.
//
// 1. Removes every file under <user_id>/ in the private `note-audio` and `recovery-videos`
//    buckets. It lists the folders rather than trusting the database rows, so files whose
//    rows are already gone are removed too.
// 2. Deletes the auth user; every user-owned table cascades from auth.users.
//
// Safe to call again after a partial failure: each step only removes what's still there.
//
// POST (no body) -> 200 { deleted: true }
// Needs the caller's Supabase session (guest or permanent). Uses the service-role key that
// Supabase provides to Edge Functions; it never leaves the server.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

const BUCKETS = ['note-audio', 'recovery-videos'] as const;
const PAGE = 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Every object path under `prefix` in `bucket`, walking sub-folders. */
async function listAll(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`List ${bucket}/${prefix}: ${error.message}`);
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders have no id; files do.
      if (entry.id === null) paths.push(...(await listAll(admin, bucket, path)));
      else paths.push(path);
    }
    if (data.length < PAGE) return paths;
  }
}

async function removeFolder(admin: SupabaseClient, bucket: string, userId: string) {
  const paths = await listAll(admin, bucket, userId);
  for (let i = 0; i < paths.length; i += PAGE) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + PAGE));
    if (error) throw new Error(`Remove from ${bucket}: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in first' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only ever the caller: the user id comes from their verified token, never from the body.
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json({ error: 'Sign in first' }, 401);
  const userId = auth.user.id;

  try {
    for (const bucket of BUCKETS) await removeFolder(admin, bucket, userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Delete user: ${error.message}`);
  } catch (error) {
    console.error('delete-account failed', error);
    return json({ error: "Couldn't delete everything. Try again." }, 500);
  }

  return json({ deleted: true });
});

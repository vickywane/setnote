/**
 * In-memory stand-in for the Supabase client in Jest. Every query resolves with no rows
 * (or null for single-row queries). Tests can override with `supabase.from.mockImplementation`.
 */
function queryBuilder(result = { data: [], error: null }) {
  const builder = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'is',
    'not',
    'order',
    'limit',
    'range',
    'gte',
    'lt',
    'ilike',
    'filter',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function storageBucket() {
  return {
    upload: jest.fn(() => Promise.resolve({ data: { path: '' }, error: null })),
    remove: jest.fn(() => Promise.resolve({ data: [], error: null })),
    createSignedUrl: jest.fn(() =>
      Promise.resolve({ data: { signedUrl: 'https://example.test/signed' }, error: null }),
    ),
  };
}

const supabase = {
  from: jest.fn(() => queryBuilder()),
  storage: { from: jest.fn(() => storageBucket()) },
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInAnonymously: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    updateUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
};

module.exports = { supabase, queryBuilder, storageBucket };

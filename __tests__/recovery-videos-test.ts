import { useAuthStore } from '@/features/auth/auth-store';
import { removeVideos, storeCheckVideo, videoLocation } from '@/features/recovery/videos';
import { supabase } from '@/lib/supabase';

// A tiny in-memory file system for the parts of expo-file-system the videos use.
const mockFiles = new Set<string>();
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
    async move(target: { uri: string }) {
      mockFiles.delete(this.uri);
      mockFiles.add(target.uri);
      this.uri = target.uri;
    }
  }
  class Directory extends File {
    create() {}
  }
  return { File, Directory, Paths: { document: { uri: 'docs' }, cache: { uri: 'cache' } } };
});

const signIn = (anonymous: boolean) =>
  useAuthStore.setState({
    session: { user: { id: 'user-1', is_anonymous: anonymous } },
  } as never);

const bucket = () =>
  (supabase.storage.from as jest.Mock).mock.results.at(-1)?.value as {
    upload: jest.Mock;
    remove: jest.Mock;
  };

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
});

describe('videoLocation', () => {
  it('keeps a guest’s videos on the phone and a signed-in user’s in the account', () => {
    signIn(true);
    expect(videoLocation()).toBe('device');
    signIn(false);
    expect(videoLocation()).toBe('cloud');
  });
});

describe('storeCheckVideo', () => {
  const recorded = { uri: 'cache/recovery-check-1.mp4', durationMs: 45_000 };
  const check = { id: 'check-1', user_id: 'user-1' };

  it('uploads a signed-in user’s video to their folder and removes the recording', async () => {
    signIn(false);
    mockFiles.add(recorded.uri);
    await expect(storeCheckVideo(check, recorded)).resolves.toEqual({
      video_path: 'user-1/check-1.mp4',
      video_location: 'cloud',
    });
    expect(supabase.storage.from).toHaveBeenCalledWith('recovery-videos');
    expect(bucket().upload).toHaveBeenCalledWith('user-1/check-1.mp4', expect.any(Uint8Array), {
      contentType: 'video/mp4',
      upsert: true,
    });
    expect(mockFiles.has(recorded.uri)).toBe(false);
  });

  it('moves a guest’s video into the documents folder', async () => {
    signIn(true);
    mockFiles.add(recorded.uri);
    await expect(storeCheckVideo(check, recorded)).resolves.toEqual({
      video_path: 'recovery-videos/check-1.mp4',
      video_location: 'device',
    });
    expect(mockFiles.has('docs/recovery-videos/check-1.mp4')).toBe(true);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('fails when the recording is missing', async () => {
    signIn(false);
    await expect(storeCheckVideo(check, recorded)).rejects.toThrow('missing');
  });
});

describe('removeVideos', () => {
  it('deletes files on the phone and objects in the account', async () => {
    mockFiles.add('docs/recovery-videos/a.mp4');
    await removeVideos([
      { video_path: 'recovery-videos/a.mp4', video_location: 'device' },
      { video_path: 'user-1/b.mp4', video_location: 'cloud' },
      { video_path: null, video_location: null },
    ]);
    expect(mockFiles.has('docs/recovery-videos/a.mp4')).toBe(false);
    expect(bucket().remove).toHaveBeenCalledWith(['user-1/b.mp4']);
  });

  it('doesn’t call Storage when there are no account videos', async () => {
    await removeVideos([{ video_path: null, video_location: null }]);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });
});

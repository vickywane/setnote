import { setAnalyticsConsent, setAnalyticsProvider, track } from '@/lib/analytics';

describe('analytics', () => {
  const provider = { track: jest.fn() };

  beforeEach(() => {
    provider.track.mockClear();
    setAnalyticsProvider(provider);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('sends nothing without consent', () => {
    setAnalyticsConsent(false);
    track('app_opened');
    expect(provider.track).not.toHaveBeenCalled();
  });

  it('sends events once the user consents', () => {
    setAnalyticsConsent(true);
    track('set_logged', { inputMode: 'structured' });
    expect(provider.track).toHaveBeenCalledWith('set_logged', { inputMode: 'structured' });
  });
});

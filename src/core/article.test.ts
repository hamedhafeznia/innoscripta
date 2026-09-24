import { normalizeUrl } from './article';

describe('normalizeUrl', () => {
  it('collapses the differences syndication introduces', () => {
    // Same story, two providers: scheme, www, tracking params, fragment, trailing slash.
    expect(normalizeUrl('http://www.Example.com/world/quake/?utm_source=x#top')).toBe(
      normalizeUrl('https://example.com/world/quake'),
    );
  });

  it('keeps genuinely different paths apart', () => {
    expect(normalizeUrl('https://example.com/world/quake')).not.toBe(
      normalizeUrl('https://example.com/world/quake-2'),
    );
  });

  it('falls back to the raw string rather than throwing on a malformed URL', () => {
    expect(normalizeUrl('  NOT a url ')).toBe('not a url');
  });
});

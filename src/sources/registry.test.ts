import { SOURCES, getSource } from './registry';

describe('source registry', () => {
  it('registers every source under a unique id', () => {
    expect(SOURCES.map((source) => source.id)).toEqual(['guardian', 'nyt', 'newsapi']);
  });

  it('gives every source the full NewsSource contract', () => {
    // A fourth adapter is added here and nowhere else; this is the contract it must meet.
    for (const source of SOURCES) {
      expect(source.label).toBeTruthy();
      expect(source.capabilities).toMatchObject({ query: expect.any(Boolean) });
      expect(source.unserviceable({ page: 1 })).toBeNull();
      expect(typeof source.notice).toBe('function');
      expect(typeof source.search).toBe('function');
    }
  });

  it('looks a source up by id', () => {
    expect(getSource('nyt')?.label).toBe('The New York Times');
  });
});

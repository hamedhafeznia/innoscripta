import { SOURCE_IDS, SOURCES, getSource, type SourceId } from './registry';

describe('source registry', () => {
  it('registers every source under a unique id', () => {
    expect(SOURCES.map((source) => source.id)).toEqual(['guardian', 'nyt', 'newsapi']);
  });

  it('gives every source the full NewsSource contract', () => {
    // A fourth adapter is added here and nowhere else; this is the contract it must meet.
    for (const source of SOURCES) {
      expect(source.label).toBeTruthy();
      expect(['server', 'client', false]).toContain(source.capabilities.category);
      expect(['server', 'client', false]).toContain(source.capabilities.author);
      expect(source.unserviceable({ page: 1 })).toBeNull();
      expect(typeof source.notice).toBe('function');
      expect(typeof source.search).toBe('function');
    }
  });

  it('looks a source up by id', () => {
    expect(getSource('nyt')?.label).toBe('The New York Times');
  });

  it('derives SourceId from what is registered, so no id is written out twice', () => {
    // A compile-time check: a fourth source added to the registry would widen this union
    // and fail here until the expectation is updated, and nowhere else.
    expectTypeOf<SourceId>().toEqualTypeOf<'guardian' | 'nyt' | 'newsapi'>();
    expect(SOURCE_IDS).toEqual(SOURCES.map((source) => source.id));
  });
});

import { makeArticle } from '../../core/testArticle';
import { groupByDay, dayKey } from './day';

const at = (publishedAt: string) => makeArticle({ publishedAt });

describe('grouping by day', () => {
  it('groups on the UTC day, not the reader’s local day', () => {
    // 23:41Z on the 6th is already the 7th east of London. Grouping locally would file
    // this article under a heading outside the range the reader filtered on.
    expect(dayKey(at('2026-09-06T23:41:15Z'))).toBe('2026-09-06');
  });

  it('keeps groups newest-first and preserves order inside each', () => {
    const groups = groupByDay([
      at('2026-09-10T22:00:00Z'),
      at('2026-09-10T08:00:00Z'),
      at('2026-09-09T23:00:00Z'),
    ]);

    expect(groups.map((g) => g.key)).toEqual(['2026-09-10', '2026-09-09']);
    expect(groups[0]!.articles).toHaveLength(2);
    expect(groups[1]!.articles).toHaveLength(1);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

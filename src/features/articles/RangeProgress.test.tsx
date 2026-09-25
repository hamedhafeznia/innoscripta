import { render } from '@testing-library/react';
import { EMPTY_FILTERS } from '../../core/filters';
import { makeArticle } from '../../core/testArticle';
import { RangeProgress } from './RangeProgress';

const at = (publishedAt: string) => makeArticle({ publishedAt });
const range = { ...EMPTY_FILTERS, from: '2026-09-01', to: '2026-09-10' };
const loaded = [at('2026-09-10T22:00:00Z'), at('2026-09-10T02:00:00Z')];

describe('RangeProgress', () => {
  it('names the next day when the range is being walked', () => {
    // The case that looked like a broken filter: ten days asked for, one day delivered.
    // Walking makes the rest reachable, and this line says where the next click goes.
    const { container } = render(
      <RangeProgress filters={range} articles={loaded} nextDay="2026-09-09" hasMore />,
    );

    const text = container.textContent ?? '';
    expect(text).toContain('The top of each day');
    expect(text).toMatch(/Load more for .*9/);
  });

  it('falls back to how far back it has read when the range is not walked', () => {
    const { container } = render(
      <RangeProgress
        filters={{ ...EMPTY_FILTERS, to: '2026-09-10' }}
        articles={loaded}
        hasMore
      />,
    );

    expect(container.textContent).toMatch(/back to .*10.* so far/);
  });

  it('says so plainly once the whole range is on screen', () => {
    const { container } = render(
      <RangeProgress filters={range} articles={loaded} hasMore={false} />,
    );

    expect(container.textContent).toContain('That is the whole range');
  });

  it('stays out of the way when no range is set', () => {
    const { container } = render(
      <RangeProgress filters={EMPTY_FILTERS} articles={loaded} hasMore />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

import { render } from '@testing-library/react';
import { makeArticle } from '../../core/testArticle';
import { ArticleCard } from './ArticleCard';

describe('ArticleCard date', () => {
  it('shows the UTC day, so it matches the range the reader filtered on', () => {
    // 23:41Z on the 6th is already the 7th in Tehran or Berlin. Showing the local day
    // puts a card dated the 7th inside a "3 to 6 September" search.
    const { container } = render(
      <ArticleCard
        article={makeArticle({ publishedAt: '2026-09-06T23:41:15Z', title: 'Late on the sixth' })}
      />,
    );

    const time = container.querySelector('time')!;
    // The day, whatever the locale orders it as — never the 7th.
    expect(time.textContent).toMatch(/\b6\b/);
    expect(time.textContent).not.toMatch(/\b7\b/);
    expect(time).toHaveAttribute('datetime', '2026-09-06T23:41:15Z');
  });
});

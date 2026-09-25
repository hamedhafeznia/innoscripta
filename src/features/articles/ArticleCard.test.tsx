import { render, screen } from '@testing-library/react';
import { makeArticle } from '../../core/testArticle';
import { ArticleCard } from './ArticleCard';

describe('ArticleCard date', () => {
  it('shows the UTC day, so it matches the range the reader filtered on', () => {
    // 23:41Z on the 6th is already the 7th in Tehran or Berlin. Showing the local day
    // puts a card dated the 7th inside a "3 to 6 September" search.
    render(
      <ArticleCard
        article={makeArticle({ publishedAt: '2026-09-06T23:41:15Z', title: 'Late on the sixth' })}
      />,
    );

    const time = screen.getByRole('time');
    // The day, whatever the locale orders it as — never the 7th.
    expect(time.textContent).toMatch(/\b6\b/);
    expect(time.textContent).not.toMatch(/\b7\b/);
    expect(time).toHaveAttribute('datetime', '2026-09-06T23:41:15Z');
  });
});

describe('ArticleCard link', () => {
  it('names the publisher it leads to, and opens it in a new tab', () => {
    const { getByRole } = render(
      <ArticleCard
        article={makeArticle({
          title: 'A story',
          publishedAt: '2026-09-06T10:00:00Z',
          publisher: 'The Irish Times',
          url: 'https://www.irishtimes.com/a-story',
        })}
      />,
    );

    const link = getByRole('link', { name: /read at the irish times/i });
    expect(link).toHaveAttribute('href', 'https://www.irishtimes.com/a-story');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

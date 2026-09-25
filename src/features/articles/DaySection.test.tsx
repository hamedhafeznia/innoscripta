import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeArticle } from '../../core/testArticle';
import { DaySection } from './DaySection';
import { groupByDay } from './day';

const day = (count: number) =>
  groupByDay(
    Array.from({ length: count }, (_, i) =>
      makeArticle({
        publishedAt: `2026-09-10T${String(23 - i).padStart(2, '0')}:00:00Z`,
        title: `Story ${i}`,
      }),
    ),
  )[0]!;

const renderSection = (count: number, collapsed = true) =>
  render(
    <MemoryRouter>
      <DaySection group={day(count)} collapsed={collapsed} />
    </MemoryRouter>,
  );

describe('DaySection', () => {
  it('shows six of a finished day and keeps the rest one click away', () => {
    renderSection(20);

    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByRole('button', { name: /Show 14 more/ })).toBeInTheDocument();
  });

  it('reveals the rest without fetching anything', async () => {
    const user = userEvent.setup();
    renderSection(20);

    await user.click(screen.getByRole('button', { name: /Show 14 more/ }));

    // The articles were already in hand; revealing them costs no request.
    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument();
  });

  it('offers no control when the day fits', () => {
    renderSection(4);

    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument();
  });

  it('never caps a day that is still being paged into', () => {
    // Load more adds to the current day here; a cap would swallow what was just asked for.
    renderSection(20, false);

    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('links its heading to that single day, which pages into it', () => {
    renderSection(20);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      '/search?from=2026-09-10&to=2026-09-10',
    );
  });

  it('links its heading to a one-day search for that day', () => {
    renderSection(3);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(within(heading).getByRole('link')).toHaveAttribute(
      'href',
      '/search?from=2026-09-10&to=2026-09-10',
    );
  });
});

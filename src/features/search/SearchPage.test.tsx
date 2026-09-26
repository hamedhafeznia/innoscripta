import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import guardianFixture from '../../test/fixtures/guardian.search.json';
import nytFixture from '../../test/fixtures/nyt.search.json';
import newsapiFixture from '../../test/fixtures/newsapi.search.json';
import { currentLocation, renderWithProviders } from '../../test/renderApp';
import { server } from '../../test/server';
import { SearchPage } from './SearchPage';

function serveAll() {
  server.use(
    http.get('*/api/guardian/search', () => HttpResponse.json(guardianFixture)),
    http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json(nytFixture)),
    http.get('*/api/newsapi/everything', () => HttpResponse.json(newsapiFixture)),
    http.get('*/api/newsapi/top-headlines', () => HttpResponse.json(newsapiFixture)),
  );
}

const anArticle = () => screen.findAllByRole('article');

describe('SearchPage', () => {
  it('renders articles from every provider for the filters in the URL', async () => {
    serveAll();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });

    expect(await anArticle()).not.toHaveLength(0);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('climate');
  });

  it('writes a typed keyword into the URL', async () => {
    serveAll();
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search' });
    await anArticle();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'climate');

    // That the keystrokes are debounced first is covered in useDebouncedValue.test.ts.
    await waitFor(() => expect(currentLocation()).toBe('/search?q=climate'));
  });

  it('puts a chosen category into the URL as ?cat=', async () => {
    serveAll();
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });
    await anArticle();

    await user.click(screen.getByRole('checkbox', { name: 'science' }));

    await waitFor(() => expect(currentLocation()).toBe('/search?q=climate&cat=science'));
  });

  it('puts a date chosen from the calendar into the URL as ?from=', async () => {
    serveAll();
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });
    await anArticle();

    await user.click(screen.getByRole('button', { name: 'From: any date' }));
    // The calendar is lazy-loaded, so the chunk resolves after the popover opens. The
    // test's own limit (below) sits well above this wait, so a slow machine fails on the
    // wait's clear message rather than on a bare test timeout.
    const grid = await screen.findByRole('grid', {}, { timeout: 10_000 });
    // The day shows its number. Only the month shown has a 12th: the greyed-out days of
    // its neighbours stop at the 6th. (By text rather than by accessible name, which asks
    // the DOM to compute a name for every day in the grid.)
    await user.click(within(grid).getByText('12'));

    await waitFor(() => expect(currentLocation()).toMatch(/[?&]from=\d{4}-\d{2}-12/));
  }, 20_000);

  it('shows what returned and a notice naming the source that failed', async () => {
    serveAll();
    server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()));

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });

    expect(await anArticle()).not.toHaveLength(0);
    const notices = await screen.findByRole('list', { name: 'Source notices' });
    expect(within(notices).getByText(/New York Times/)).toBeInTheDocument();
  });

  it('lets a notice be dismissed', async () => {
    serveAll();
    server.use(http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()));
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });

    const notices = await screen.findByRole('list', { name: 'Source notices' });
    await user.click(within(notices).getByRole('button', { name: /Dismiss notice/ }));

    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Source notices' })).not.toBeInTheDocument(),
    );
  });

  it('appends the next page when Load more is pressed', async () => {
    serveAll();
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });
    const first = await anArticle();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(async () => expect((await anArticle()).length).toBeGreaterThan(first.length));
  });

  it('does not offer to load more of what it never reached', async () => {
    server.use(
      http.get('*/api/guardian/search', () => HttpResponse.error()),
      http.get('*/api/nyt/articlesearch.json', () => HttpResponse.error()),
      http.get('*/api/newsapi/everything', () => HttpResponse.error()),
    );

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });

    expect(await screen.findByText('No source could be reached.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing matched in the pages checked/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('offers a retry, not "that is everything", when every source fails on Load more', async () => {
    let failing = false;
    const answer = (body: unknown) => () =>
      failing ? HttpResponse.error() : HttpResponse.json(body as object);
    server.use(
      http.get('*/api/guardian/search', answer(guardianFixture)),
      http.get('*/api/nyt/articlesearch.json', answer(nytFixture)),
      http.get('*/api/newsapi/everything', answer(newsapiFixture)),
    );
    const user = userEvent.setup();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });
    const first = await anArticle();

    failing = true;
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // Nothing was searched, so the reader must not be told there is nothing left.
    expect(await screen.findByText(/No source could be reached to load more/)).toBeInTheDocument();
    expect(screen.queryByText(/That is everything/)).not.toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(async () => expect((await anArticle()).length).toBeGreaterThan(first.length));
  });

  it('collapses one identical failure per source into a single notice', async () => {
    server.use(
      http.get('*/api/guardian/search', () => HttpResponse.json({}, { status: 401 })),
      http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json({}, { status: 401 })),
      http.get('*/api/newsapi/everything', () => HttpResponse.json({}, { status: 401 })),
    );

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });

    const notices = await screen.findByRole('list', { name: 'Source notices' });
    expect(within(notices).getAllByRole('listitem')).toHaveLength(1);
    expect(
      within(notices).getByText(/The Guardian, The New York Times and NewsAPI/),
    ).toBeInTheDocument();
  });

  it('walks h1 to h2 to h3 with no level skipped', async () => {
    // A screen reader's heading list is a table of contents. The day is the section and
    // the headline sits inside it; jumping h1 -> h3 would hide that structure.
    serveAll();

    renderWithProviders(<SearchPage />, { route: '/search?q=climate' });
    await anArticle();

    const levels = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.tagName);
    expect(levels[0]).toBe('H1');
    expect(levels[1]).toBe('H2');
    expect(levels[2]).toBe('H3');
  });

  it('explains an empty result rather than showing a blank page', async () => {
    server.use(
      http.get('*/api/guardian/search', () =>
        HttpResponse.json({ response: { currentPage: 1, pages: 1, results: [] } }),
      ),
      http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json({ response: { docs: [] } })),
      http.get('*/api/newsapi/everything', () => HttpResponse.json({ status: 'ok', articles: [] })),
    );

    renderWithProviders(<SearchPage />, { route: '/search?q=nothingmatchesthis' });

    expect(await screen.findByText(/No articles matched these filters/)).toBeInTheDocument();
  });
});

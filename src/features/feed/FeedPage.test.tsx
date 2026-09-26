import { delay, http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import guardianFixture from '../../test/fixtures/guardian.search.json';
import nytFixture from '../../test/fixtures/nyt.search.json';
import newsapiFixture from '../../test/fixtures/newsapi.search.json';
import { currentLocation, renderWithProviders } from '../../test/renderApp';
import { server } from '../../test/server';
import { usePreferences } from '../preferences/store';
import { FeedPage } from './FeedPage';

function serveAll() {
  server.use(
    http.get('*/api/guardian/search', () => HttpResponse.json(guardianFixture)),
    http.get('*/api/nyt/articlesearch.json', () => HttpResponse.json(nytFixture)),
    http.get('*/api/newsapi/everything', () => HttpResponse.json(newsapiFixture)),
    http.get('*/api/newsapi/top-headlines', () => HttpResponse.json(newsapiFixture)),
  );
}

describe('FeedPage', () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferences.getState().clear();
  });

  it('asks for preferences instead of fetching when there are none', async () => {
    renderWithProviders(<FeedPage />, { route: '/feed' });

    expect(await screen.findByText(/your feed will build itself here/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('builds the feed from stored preferences, with no URL parameters of its own', async () => {
    serveAll();
    usePreferences.getState().toggleCategory('science');

    renderWithProviders(<FeedPage />, { route: '/feed' });

    expect(await screen.findAllByRole('article')).not.toHaveLength(0);
    expect(currentLocation()).toBe('/feed');
  });

  it('refetches the feed when a preference changes', async () => {
    serveAll();
    const user = userEvent.setup();
    usePreferences.getState().toggleSource('guardian');

    renderWithProviders(<FeedPage />, { route: '/feed' });
    await screen.findAllByRole('article');

    const providers = screen.getByRole('group', { name: 'Providers I read' });
    await user.click(within(providers).getByRole('checkbox', { name: 'The Guardian' }));

    await waitFor(() =>
      expect(within(providers).getByRole('checkbox', { name: 'The Guardian' })).not.toBeChecked(),
    );
  });

  it('carries the preference-derived filters into /search when refining', async () => {
    serveAll();
    const user = userEvent.setup();
    usePreferences.getState().toggleCategory('science');
    usePreferences.getState().toggleSource('guardian');

    renderWithProviders(<FeedPage />, { route: '/feed' });
    await screen.findAllByRole('article');

    await user.click(screen.getByRole('link', { name: 'Refine in search' }));

    await waitFor(() => expect(currentLocation()).toBe('/search?cat=science&src=guardian'));
  });

  it('offers no Follow button on its cards: authors are followed from search', async () => {
    // Following narrows the feed, so doing it from inside the feed rebuilds the page under
    // the reader's finger. The feed lists whom you follow and lets you unfollow; adding
    // someone happens in /search.
    serveAll();
    usePreferences.getState().toggleSource('guardian');

    renderWithProviders(<FeedPage />, { route: '/feed' });
    const [first] = await screen.findAllByRole('article');

    expect(within(first!).queryByRole('button', { name: /^Follow / })).not.toBeInTheDocument();
  });

  it('says where author filtering happens once an author is followed', async () => {
    serveAll();
    usePreferences.getState().toggleSource('guardian');
    usePreferences.getState().followAuthor({
      ...(await import('../../core/testArticle')).makeArticle({
        publishedAt: '2026-09-24T00:00:00Z',
        author: 'Lucy Campbell',
        authorRef: 'profile/lucy-campbell',
      }),
    });

    renderWithProviders(<FeedPage />, { route: '/feed' });

    expect(await screen.findByText(/filtered on this device after fetching/)).toBeInTheDocument();
  });

  it('keeps the feed on screen while it refetches for a changed preference', async () => {
    // A changed preference changes what the feed asks for. Dropping to the loading
    // skeleton while it does reads as the page reloading, and throws away the reader's
    // place in it.
    serveAll();
    let slow = false;
    server.use(
      http.get('*/api/guardian/search', async () => {
        if (slow) await delay(400);
        return HttpResponse.json(guardianFixture);
      }),
    );
    const user = userEvent.setup();
    usePreferences.getState().toggleSource('guardian');

    renderWithProviders(<FeedPage />, { route: '/feed' });
    await screen.findAllByRole('article');

    // From here the refetch is in flight when we look.
    slow = true;
    await user.click(screen.getByRole('checkbox', { name: 'science' }));

    expect(screen.queryByText('Loading your feed')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  });

  it('says the followed authors are why nothing matched, instead of a generic empty state', async () => {
    serveAll();
    usePreferences.getState().toggleSource('guardian');
    usePreferences.setState({ authors: [{ name: 'Nobody At All', ref: null }] });

    renderWithProviders(<FeedPage />, { route: '/feed' });

    // Followed authors narrow the feed to their articles within the chosen providers and
    // categories, so an empty feed with follows is very likely about the follows.
    const empty = await screen.findByText(/nothing matched.*followed author/i);
    expect(empty).toHaveTextContent(/unfollow/i);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('does not blame followed authors when there are none', async () => {
    server.use(
      http.get('*/api/guardian/search', () =>
        HttpResponse.json({ response: { currentPage: 1, pages: 1, results: [] } }),
      ),
    );
    usePreferences.getState().toggleSource('guardian');

    renderWithProviders(<FeedPage />, { route: '/feed' });

    expect(await screen.findByText(/Nothing matched your preferences yet/)).toBeInTheDocument();
    expect(screen.queryByText(/followed author/i)).not.toBeInTheDocument();
  });
});

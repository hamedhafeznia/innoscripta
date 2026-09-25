import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

/** A fresh client per test: retries off and no caching between tests. */
function testQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
}

/**
 * Exposes the router's location to assertions. Under MemoryRouter `window.location`
 * never changes, so a test that reads it is asserting nothing at all.
 */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

export function renderWithProviders(ui: ReactNode, { route = '/' } = {}) {
  return render(
    <QueryClientProvider client={testQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The router's current path and query string, as the address bar would show it. */
export function currentLocation(): string {
  return screen.getByTestId('location').textContent ?? '';
}

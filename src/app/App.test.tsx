import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('redirects the root path to /search', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/search');
  });
});

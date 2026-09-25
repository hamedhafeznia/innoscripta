import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { queryClient } from './queryClient';
import { SearchPage } from '../features/search/SearchPage';
import { FeedPage } from '../features/feed/FeedPage';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2"
          href="#main"
        >
          Skip to content
        </a>
        <header className="flex flex-wrap items-baseline justify-between gap-4 border-b p-4">
          <span className="font-semibold">innoscripta news</span>
          <nav aria-label="Primary" className="flex gap-3">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'
              }
            >
              Search
            </NavLink>
            <NavLink
              to="/feed"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'
              }
            >
              My feed
            </NavLink>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="*" element={<Navigate to="/search" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

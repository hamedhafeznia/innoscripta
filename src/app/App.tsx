import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { queryClient } from './queryClient';
import { ThemeToggle } from '../features/preferences/ThemeToggle';
import { useApplyTheme } from '../features/preferences/theme';
import { SearchPage } from '../features/search/SearchPage';
import { FeedPage } from '../features/feed/FeedPage';

export function App() {
  useApplyTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-lg focus:border focus:bg-background focus:px-3 focus:py-2"
          href="#main"
        >
          Skip to content
        </a>
        {/* Sticky and quiet: a hairline and the wordmark, so the page below it is the
            thing with presence. Solid rather than blurred — nothing here needs to suggest
            depth, and a calm surface is the point. */}
        <header // Fully opaque: at 98% the day headings ghost through as they scroll under it.
          className="sticky top-0 z-20 border-b bg-background">
          <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-4 px-4 py-3.5 sm:px-6">
            <span className="font-serif text-[1.15rem] leading-none font-medium tracking-[-0.015em]">
              innoscripta <span className="text-muted-foreground">news</span>
            </span>
            <nav aria-label="Primary" className="flex items-center gap-5">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `relative text-sm underline-offset-[6px] decoration-1 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 ${
                  isActive
                    ? 'font-medium text-foreground underline'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              Search
            </NavLink>
            <NavLink
              to="/feed"
              className={({ isActive }) =>
                `relative text-sm underline-offset-[6px] decoration-1 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 ${
                  isActive
                    ? 'font-medium text-foreground underline'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              My feed
            </NavLink>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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

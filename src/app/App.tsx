import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { queryClient } from './queryClient';
import { SearchPage } from '../features/search/SearchPage';
import { FeedPage } from '../features/feed/FeedPage';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          <span className="app-title">innoscripta news</span>
          <nav aria-label="Primary">
            <NavLink to="/search">Search</NavLink>
            <NavLink to="/feed">My feed</NavLink>
          </nav>
        </header>
        <main id="main" className="app-main">
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

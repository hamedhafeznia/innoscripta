import '@testing-library/jest-dom/vitest';
import { server } from './server';

// `error` so an unhandled request fails loudly rather than silently returning nothing.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import '@testing-library/jest-dom/vitest';
import { server } from './server';

// jsdom implements neither of these, and Radix's popover layer needs both. They measure
// and scroll, so a no-op is the honest stub: there is no layout in jsdom to observe.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Element.prototype.scrollIntoView ??= () => {};

// jsdom has no matchMedia. The stub reports "no preference" so the default `system` theme
// resolves to light, which is what an assertion about colour would otherwise have to guess.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

// `error` so an unhandled request fails loudly rather than silently returning nothing.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

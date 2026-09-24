import { setupServer } from 'msw/node';

/** Handlers are registered per test file with `server.use(...)`. */
export const server = setupServer();

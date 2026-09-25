/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';


/**
 * Dev proxy mirrors the nginx `/api/*` routes exactly (see nginx/templates/default.conf.template).
 * App code therefore never knows whether it runs under `vite dev` or nginx: it always calls
 * same-origin `/api/<source>/...` and never sees an API key.
 *
 * Keys live in `.env` WITHOUT the `VITE_` prefix, so Vite refuses to inline them into the bundle.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  /** Appends the key to the outgoing query string, the same way envsubst does in nginx. */
  const withKey = (url: string, param: string, value: string | undefined) => {
    const [pathname, query = ''] = url.split('?');
    const search = new URLSearchParams(query);
    if (value) search.set(param, value);
    return `${pathname}?${search.toString()}`;
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      port: 5173,
      proxy: {
        '/api/guardian': {
          target: 'https://content.guardianapis.com',
          changeOrigin: true,
          rewrite: (url) =>
            withKey(url.replace(/^\/api\/guardian/, ''), 'api-key', env.GUARDIAN_KEY),
        },
        '/api/nyt': {
          target: 'https://api.nytimes.com',
          changeOrigin: true,
          rewrite: (url) =>
            withKey(
              url.replace(/^\/api\/nyt/, '/svc/search/v2'),
              'api-key',
              env.NYT_KEY,
            ),
        },
        '/api/newsapi': {
          target: 'https://newsapi.org',
          changeOrigin: true,
          rewrite: (url) =>
            withKey(url.replace(/^\/api\/newsapi/, '/v2'), 'apiKey', env.NEWSAPI_KEY),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});

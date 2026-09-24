import { http, HttpResponse, type JsonBodyType } from 'msw';
import { server } from './server';

/**
 * Answers `path` with `body` and hands back the URL the adapter actually requested,
 * so a test can assert on the outgoing params as well as the mapped result.
 */
export function captureRequest(path: string, body: JsonBodyType): { get url(): URL } {
  let captured: URL | undefined;

  server.use(
    http.get(`*${path}`, ({ request }) => {
      captured = new URL(request.url);
      return HttpResponse.json(body);
    }),
  );

  return {
    get url() {
      if (!captured) throw new Error(`No request was made to ${path}`);
      return captured;
    },
  };
}

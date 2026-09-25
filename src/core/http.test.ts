import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { server } from '../test/server';
import { fetchJson, SourceError } from './http';

const schema = z.object({ items: z.array(z.string()) });

/** What the caller sees when the request goes wrong: the kind and the reader-facing line. */
async function failure(url = '/api/guardian/search') {
  try {
    await fetchJson('guardian', url, schema);
  } catch (error) {
    if (error instanceof SourceError) return { kind: error.kind, message: error.message };
    throw error;
  }
  throw new Error('expected fetchJson to throw');
}

describe('fetchJson', () => {
  it('returns the parsed body when it has the shape the schema describes', async () => {
    server.use(http.get('*/api/guardian/search', () => HttpResponse.json({ items: ['a'] })));

    await expect(fetchJson('guardian', '/api/guardian/search', schema)).resolves.toEqual({
      items: ['a'],
    });
  });

  describe('mapping what went wrong onto a SourceError', () => {
    it.each([
      [429, 'rateLimited', 'has hit its request limit for now.'],
      [401, 'unauthorized', 'would not let us in.'],
      [403, 'unauthorized', 'would not let us in.'],
      [500, 'upstream', 'is not responding just now.'],
      [404, 'upstream', 'is not responding just now.'],
    ])('reads a %i as %s', async (status, kind, message) => {
      server.use(http.get('*/api/guardian/search', () => HttpResponse.json({}, { status })));

      await expect(failure()).resolves.toEqual({ kind, message });
    });

    it('reads a request that never completed as a network failure', async () => {
      server.use(http.get('*/api/guardian/search', () => HttpResponse.error()));

      await expect(failure()).resolves.toMatchObject({ kind: 'network' });
    });

    it('reads a body that is not JSON as an upstream failure', async () => {
      server.use(http.get('*/api/guardian/search', () => HttpResponse.text('<html>oops</html>')));

      await expect(failure()).resolves.toMatchObject({ kind: 'upstream' });
    });

    it('reads JSON of the wrong shape as an upstream failure, not a crash later on', async () => {
      server.use(http.get('*/api/guardian/search', () => HttpResponse.json({ items: 'nope' })));

      await expect(failure()).resolves.toEqual({
        kind: 'upstream',
        message: 'sent something we could not read.',
      });
    });
  });

  it('lets an abort through untouched, since a cancelled request is not a source failing', async () => {
    server.use(http.get('*/api/guardian/search', () => HttpResponse.json({ items: [] })));
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchJson('guardian', '/api/guardian/search', schema, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

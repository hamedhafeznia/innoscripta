import type { z } from 'zod';
import type { SourceId } from './article';

export type SourceErrorKind =
  /** The source's quota is spent. NewsAPI's free plan allows 100 requests a day. */
  | 'rateLimited'
  /** Missing or rejected key: the reviewer killed it, or never set it. */
  | 'unauthorized'
  /** Any other non-2xx, or a response we could not parse. */
  | 'upstream'
  /** The request never completed. */
  | 'network';

/** Carries enough for the per-source notice to say something true and specific. */
export class SourceError extends Error {
  constructor(
    readonly sourceId: SourceId,
    readonly kind: SourceErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}

/** Builds a query string, dropping empty values so no `&q=` noise reaches the upstream. */
export function buildUrl(
  path: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Fetches JSON from the same-origin `/api/*` proxy. No key handling here by design:
 * the key is added by nginx (or Vite's dev proxy) and never exists in the browser.
 *
 * The body is checked against `schema` rather than cast: an answer of the wrong shape is
 * the source failing, and should say so, not surface as a TypeError three calls later.
 * Schemas describe the envelope only; each item is validated on its own (`keepValid`),
 * so one bad article does not fail the page.
 */
export async function fetchJson<S extends z.ZodType>(
  sourceId: SourceId,
  url: string,
  schema: S,
  signal?: AbortSignal,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (cause) {
    // By name, not `instanceof DOMException`: the class differs between realms, the name does not.
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new SourceError(sourceId, 'network', 'could not be reached.');
  }

  if (!response.ok) {
    throw new SourceError(
      sourceId,
      kindFromStatus(response.status),
      messageFromStatus(response.status),
    );
  }

  const unreadable = () =>
    new SourceError(sourceId, 'upstream', 'sent something we could not read.');

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw unreadable();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw unreadable();
  return parsed.data;
}

function kindFromStatus(status: number): SourceErrorKind {
  if (status === 429) return 'rateLimited';
  if (status === 401 || status === 403) return 'unauthorized';
  return 'upstream';
}

/**
 * Reader-facing, always. An HTTP status code on screen tells a reader nothing except
 * that something technical broke and they are not the audience for the explanation.
 */
function messageFromStatus(status: number): string {
  // Neutral about the window on purpose. A 429 from NewsAPI is its 100-a-day cap, but
  // from NYT it is usually a per-minute throttle that clears in seconds, and the status
  // alone cannot tell them apart. "Today" would send a reader away for a day over a
  // one-minute limit.
  if (status === 429) return 'has hit its request limit for now.';
  if (status === 401 || status === 403) return 'would not let us in.';
  return 'is not responding just now.';
}

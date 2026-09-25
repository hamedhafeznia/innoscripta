import type { SourceId } from './article';

export type SourceErrorKind =
  /** The source's quota is spent. NewsAPI's free plan allows 100 requests a day. */
  | 'rateLimited'
  /** Missing or rejected key — the reviewer killed it, or never set it. */
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
export function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
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
 */
export async function fetchJson<T>(
  sourceId: SourceId,
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new SourceError(sourceId, 'network', 'could not be reached.');
  }

  if (!response.ok) {
    throw new SourceError(
      sourceId,
      kindFromStatus(response.status),
      messageFromStatus(response.status),
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new SourceError(sourceId, 'upstream', 'sent something we could not read.');
  }
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
  if (status === 429) return 'has answered all it can today.';
  if (status === 401 || status === 403) return 'would not let us in.';
  return 'is not responding just now.';
}

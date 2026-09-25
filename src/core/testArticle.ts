import type { Article, SourceId } from './article';
import { normalizeUrl } from './article';

let seq = 0;

/** Builds an Article for tests. Only the fields a test cares about need naming. */
export function makeArticle(overrides: Partial<Article> & { publishedAt: string }): Article {
  const source: SourceId = overrides.source ?? 'guardian';
  const url = overrides.url ?? `https://example.com/${source}/${(seq += 1)}`;

  return {
    id: `${source}:${url}`,
    title: 'Headline',
    publisher: null,
    author: null,
    authorRef: null,
    description: null,
    imageUrl: null,
    sourceCategory: null,
    category: 'general',
    ...overrides,
    source,
    url,
    normalizedUrl: normalizeUrl(url),
  };
}

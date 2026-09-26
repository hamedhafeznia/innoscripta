import { z } from 'zod';
import type { Article, Category } from '../core/article';
import { normalizeUrl } from '../core/article';
import { buildUrl, fetchJson } from '../core/http';
import { PAGE_SIZE, type NewsSource, type SearchParams, type SourcePage } from '../core/source';
import { asHttpUrl, httpUrl, keepValid, optionalText, requiredText, timestamp } from '../core/validate';

/** Article Search returns a fixed 10 docs and caps out at 100 pages (1000 results). */
const MAX_PAGES = 100;

/**
 * NYT section_name / news_desk -> canonical category. Local to this adapter on purpose.
 *
 * Both fields are checked because NYT files politics under section "U.S." with desk
 * "Politics", and climate under both section and desk "Climate".
 */
const CATEGORY_BY_NYT_DESK: Record<string, Category> = {
  business: 'business',
  'business day': 'business',
  dealbook: 'business',
  technology: 'technology',
  sports: 'sports',
  science: 'science',
  climate: 'science',
  health: 'health',
  well: 'health',
  politics: 'politics',
  washington: 'politics',
  arts: 'entertainment',
  movies: 'entertainment',
  theater: 'entertainment',
  television: 'entertainment',
  music: 'entertainment',
  culture: 'entertainment',
  books: 'entertainment',
  styles: 'entertainment',
};

/** What an article cannot do without; everything else degrades to absent. */
const nytImage = z.object({ url: optionalText }).optional().catch(undefined);

const nytDoc = z.object({
  _id: requiredText,
  web_url: httpUrl,
  headline: z.object({ main: requiredText }),
  pub_date: timestamp,
  abstract: optionalText,
  snippet: optionalText,
  section_name: optionalText,
  news_desk: optionalText,
  byline: z.object({ original: optionalText }).nullish().catch(undefined),
  source: optionalText,
  multimedia: z
    .object({ default: nytImage, thumbnail: nytImage })
    .nullish()
    .catch(undefined),
});

type NytDoc = z.output<typeof nytDoc>;

/** The envelope only: items are validated one by one so a bad one is dropped, not fatal. */
const nytResponse = z.object({
  response: z.object({ docs: z.array(z.unknown()).nullish() }),
});

/** "By Muktita Suhartono and Ulet Ifansasti" -> "Muktita Suhartono, Ulet Ifansasti". */
function normalizeByline(byline: string | null | undefined): string | null {
  if (!byline) return null;

  const names = byline
    .replace(/^by\s+/i, '')
    .split(/\s*,\s*|\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean);

  return names.length ? names.join(', ') : null;
}

/**
 * Article Search now returns absolute `https://static01.nyt.com/...` image URLs in a
 * `multimedia` object. Older responses used an array of paths relative to that host,
 * and the fixtures a reviewer captures tomorrow could be either, so both are handled.
 */
function toImageUrl(multimedia: NytDoc['multimedia']): string | null {
  const url = multimedia?.default?.url ?? multimedia?.thumbnail?.url;
  if (!url) return null;
  // Anything with a scheme is absolute and must be http(s); only a bare path is prefixed.
  const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
  return asHttpUrl(isAbsolute ? url : `https://static01.nyt.com/${url.replace(/^\/+/, '')}`);
}

export function toArticle(doc: NytDoc): Article {
  const desk = doc.news_desk?.toLowerCase() ?? '';
  const section = doc.section_name?.toLowerCase() ?? '';

  return {
    id: `nyt:${doc._id}`,
    title: doc.headline.main,
    url: doc.web_url,
    normalizedUrl: normalizeUrl(doc.web_url),
    publishedAt: doc.pub_date,
    source: 'nyt',
    publisher: doc.source ?? 'The New York Times',
    author: normalizeByline(doc.byline?.original),
    // NYT publishes a byline string and no author identifier, so there is nothing to ref.
    authorRef: null,
    description: doc.abstract || doc.snippet || null,
    imageUrl: toImageUrl(doc.multimedia),
    sourceCategory: doc.section_name ?? doc.news_desk ?? null,
    category: CATEGORY_BY_NYT_DESK[desk] ?? CATEGORY_BY_NYT_DESK[section] ?? 'general',
  };
}

export const nytSource: NewsSource<'nyt'> = {
  id: 'nyt',
  label: 'The New York Times',
  // Category and author are filtered client-side: see the `fq` note in search() below.
  capabilities: { category: 'client', author: 'client' },

  unserviceable: () => null,
  notice: () => null,

  async search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage> {
    // No `fq` is sent. Every `fq` query against the live API — including the examples in
    // NYT's own documentation — now comes back `hits: 0, docs: null`, so sending one would
    // silently drop NYT out of any category- or author-filtered search. Filtering those
    // two facets client-side costs a little precision and always returns something.
    const url = buildUrl('/api/nyt/articlesearch.json', {
      q: params.query,
      page: params.page - 1, // NYT pages are 0-indexed.
      sort: 'newest',
      begin_date: params.from?.replaceAll('-', ''),
      end_date: params.to?.replaceAll('-', ''),
    });

    const { response } = await fetchJson('nyt', url, nytResponse, signal);
    const docs = response.docs ?? [];

    return {
      articles: keepValid(nytDoc, docs).map(toArticle),
      // Judged on what came back, not on what survived validation.
      exhausted: params.page >= MAX_PAGES || docs.length < PAGE_SIZE,
    };
  },
};

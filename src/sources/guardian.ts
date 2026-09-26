import { z } from 'zod';
import type { Article, Category } from '../core/article';
import { normalizeUrl } from '../core/article';
import { buildUrl, fetchJson } from '../core/http';
import { PAGE_SIZE, type NewsSource, type SearchParams, type SourcePage } from '../core/source';
import { asHttpUrl, httpUrl, keepValid, optionalText, requiredText, timestamp } from '../core/validate';

/**
 * Guardian section id -> canonical category. Local to this adapter on purpose: a shared
 * `categoryMap` would look DRY but would mean a fourth source could not be added without
 * editing a file that three other adapters depend on.
 *
 * The one table, read both ways. The Guardian splits culture across several sections and
 * files climate under environment, so it is many-to-one this way and one-to-many the
 * other (`sectionsFor`). Two tables would be free to disagree, and did: filtering on
 * `culture` alone hid every film and music story the card would happily label
 * entertainment.
 */
const CATEGORY_BY_SECTION: Record<string, Category> = {
  business: 'business',
  money: 'business',
  technology: 'technology',
  sport: 'sports',
  football: 'sports',
  science: 'science',
  environment: 'science',
  society: 'health',
  'healthcare-network': 'health',
  politics: 'politics',
  'us-news': 'politics',
  culture: 'entertainment',
  film: 'entertainment',
  music: 'entertainment',
  'tv-and-radio': 'entertainment',
  stage: 'entertainment',
  games: 'entertainment',
  books: 'entertainment',
};

/** Every section this adapter files under `category`: what a filter has to ask for. */
function sectionsFor(category: Category): string[] {
  return Object.entries(CATEGORY_BY_SECTION)
    .filter(([, mapped]) => mapped === category)
    .map(([section]) => section);
}

/** What an article cannot do without; everything else degrades to absent. */
const guardianResult = z.object({
  id: requiredText,
  webUrl: httpUrl,
  webTitle: requiredText,
  webPublicationDate: timestamp,
  sectionId: optionalText,
  sectionName: optionalText,
  fields: z
    .object({ thumbnail: optionalText, trailText: optionalText, byline: optionalText })
    .optional()
    .catch(undefined),
  tags: z
    .array(z.object({ id: z.string(), type: z.string(), webTitle: z.string() }))
    .optional()
    .catch(undefined),
});

type GuardianResult = z.output<typeof guardianResult>;

/** The envelope only: items are validated one by one so a bad one is dropped, not fatal. */
const guardianResponse = z.object({
  response: z.object({
    currentPage: z.number(),
    pages: z.number(),
    results: z.array(z.unknown()),
  }),
});

/** "Lucy Campbell (now); Shannon Ho (earlier)" -> "Lucy Campbell, Shannon Ho". */
function normalizeByline(byline: string | null | undefined): string | null {
  if (!byline) return null;

  const cleaned = byline
    .replace(/^by\s+/i, '')
    .split(/\s*;\s*|\s+and\s+/i)
    .map((name) => name.replace(/\s*\([^)]*\)\s*/g, '').trim())
    .filter(Boolean);

  return cleaned.length ? cleaned.join(', ') : null;
}

/** Strips the Guardian's HTML from trailText, which is markup, not plain text. */
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, '').trim();
  return text || null;
}

export function toArticle(result: GuardianResult): Article {
  const contributors = (result.tags ?? []).filter((tag) => tag.type === 'contributor');
  const author =
    normalizeByline(result.fields?.byline) ??
    (contributors.length ? contributors.map((tag) => tag.webTitle).join(', ') : null);

  return {
    id: `guardian:${result.id}`,
    title: result.webTitle,
    url: result.webUrl,
    normalizedUrl: normalizeUrl(result.webUrl),
    publishedAt: result.webPublicationDate,
    source: 'guardian',
    publisher: 'The Guardian',
    author,
    // The first contributor is the primary author; following is per person, not per byline.
    authorRef: contributors[0]?.id ?? null,
    description: stripHtml(result.fields?.trailText),
    imageUrl: asHttpUrl(result.fields?.thumbnail),
    sourceCategory: result.sectionName ?? null,
    category: (result.sectionId && CATEGORY_BY_SECTION[result.sectionId]) || 'general',
  };
}

export const guardianSource: NewsSource<'guardian'> = {
  id: 'guardian',
  label: 'The Guardian',
  capabilities: { category: 'server', author: 'server' },

  unserviceable: () => null,
  notice: () => null,

  async search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage> {
    // The Guardian ORs pipe-separated values within one filter and ANDs across filters,
    // which is exactly the semantics the app promises: categories AND, authors OR.
    const sections = (params.categories ?? [])
      .filter((category) => category !== 'general')
      .flatMap(sectionsFor)
      .join('|');

    // Already contributor tag ids (`profile/<slug>`), carried on Article.authorRef:
    // the Guardian's own identifier, not a name we could have guessed the slug from.
    const authorTags = (params.authors ?? []).join('|');

    const url = buildUrl('/api/guardian/search', {
      q: params.query,
      page: params.page,
      'page-size': PAGE_SIZE,
      'order-by': 'newest',
      'show-fields': 'thumbnail,trailText,byline',
      'show-tags': 'contributor',
      'from-date': params.from,
      'to-date': params.to,
      section: sections || undefined,
      tag: authorTags || undefined,
    });

    const { response } = await fetchJson('guardian', url, guardianResponse, signal);

    return {
      articles: keepValid(guardianResult, response.results).map(toArticle),
      // Judged on what came back, not on what survived validation: a full page with one
      // unusable article in it is still a full page.
      exhausted: response.currentPage >= response.pages || response.results.length < PAGE_SIZE,
    };
  },
};

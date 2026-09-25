import type { Article, Category } from '../core/article';
import { normalizeUrl } from '../core/article';
import { buildUrl, fetchJson } from '../core/http';
import { PAGE_SIZE, type NewsSource, type SearchParams, type SourcePage } from '../core/source';

/**
 * Canonical category -> Guardian section id. Deliberately local to this adapter:
 * a shared `categoryMap` would look DRY but would mean a fourth source could not be
 * added without editing a file that three other adapters depend on.
 */
const SECTION_BY_CATEGORY: Record<Exclude<Category, 'general'>, string> = {
  business: 'business',
  technology: 'technology',
  sports: 'sport',
  science: 'science',
  health: 'society',
  politics: 'politics',
  entertainment: 'culture',
};

/**
 * Guardian section id -> canonical category. Not a mechanical inverse of the map above:
 * the Guardian splits culture across several sections and files climate under
 * environment, so the mapping is many-to-one in this direction.
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

interface GuardianTag {
  id: string;
  type: string;
  webTitle: string;
}

interface GuardianResult {
  id: string;
  sectionId?: string;
  sectionName?: string;
  webPublicationDate: string;
  webTitle: string;
  webUrl: string;
  fields?: { thumbnail?: string; trailText?: string; byline?: string };
  tags?: GuardianTag[];
}

interface GuardianResponse {
  response: {
    currentPage: number;
    pages: number;
    results: GuardianResult[];
  };
}

/** "Lucy Campbell (now); Shannon Ho (earlier)" -> "Lucy Campbell, Shannon Ho". */
function normalizeByline(byline: string | undefined): string | null {
  if (!byline) return null;

  const cleaned = byline
    .replace(/^by\s+/i, '')
    .split(/\s*;\s*|\s+and\s+/i)
    .map((name) => name.replace(/\s*\([^)]*\)\s*/g, '').trim())
    .filter(Boolean);

  return cleaned.length ? cleaned.join(', ') : null;
}

/** Strips the Guardian's HTML from trailText, which is markup, not plain text. */
function stripHtml(html: string | undefined): string | null {
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
    imageUrl: result.fields?.thumbnail ?? null,
    sourceCategory: result.sectionName ?? null,
    category: (result.sectionId && CATEGORY_BY_SECTION[result.sectionId]) || 'general',
  };
}

export const guardianSource: NewsSource = {
  id: 'guardian',
  label: 'The Guardian',
  capabilities: { query: true, dateRange: true, category: 'server', author: 'server' },

  unserviceable: () => null,
  notice: () => null,

  async search(params: SearchParams, signal?: AbortSignal): Promise<SourcePage> {
    // The Guardian ORs pipe-separated values within one filter and ANDs across filters,
    // which is exactly the semantics the app promises: categories AND, authors OR.
    const sections = (params.categories ?? [])
      .filter((category) => category !== 'general')
      .map((category) => SECTION_BY_CATEGORY[category as Exclude<Category, 'general'>])
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

    const { response } = await fetchJson<GuardianResponse>('guardian', url, signal);

    return {
      articles: response.results.map(toArticle),
      exhausted: response.currentPage >= response.pages || response.results.length < PAGE_SIZE,
    };
  },
};

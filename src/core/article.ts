/** The three providers we fan out to. `src` in the URL selects these, not publishers. */
export type SourceId = 'guardian' | 'nyt' | 'newsapi';

/**
 * Canonical categories, used for *filtering* only. Each adapter maps its own native
 * taxonomy onto these two ways; anything it cannot place becomes `general`.
 * The native value survives on `Article.sourceCategory` for *display*.
 */
export const CATEGORIES = [
  'business',
  'technology',
  'sports',
  'science',
  'health',
  'politics',
  'entertainment',
  'general',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export interface Article {
  /** `<sourceId>:<native id>` — stable across pages, unique across sources. */
  id: string;
  title: string;
  /** The original URL, used for the outbound link. Never normalised in place. */
  url: string;
  /** Dedupe key only — see `normalizeUrl`. */
  normalizedUrl: string;
  /** ISO 8601. Every adapter converts its native format to this. */
  publishedAt: string;
  /** Which adapter produced the article. */
  source: SourceId;
  /** Publisher name where the source gives us one (e.g. NewsAPI `source.name`). */
  publisher: string | null;
  /** Normalised by the adapter: no leading "By ", no trailing whitespace. */
  author: string | null;
  description: string | null;
  imageUrl: string | null;
  /** The source's own category label, for display. */
  sourceCategory: string | null;
  /** Canonical category, for filtering. */
  category: Category;
}

/**
 * Dedupe key: lowercase host, no `www.`, forced https, no query string, no fragment,
 * no trailing slash. The same story syndicated through two providers differs in exactly
 * these ways (tracking params above all), and in little else.
 *
 * Falls back to the trimmed, lowercased input when the URL will not parse, so a
 * malformed URL still dedupes against an identical malformed URL rather than throwing.
 */
export function normalizeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url.trim().toLowerCase();
  }

  const host = parsed.host.toLowerCase().replace(/^www\./, '');
  const path = parsed.pathname.replace(/\/+$/, '');

  return `https://${host}${path}`;
}

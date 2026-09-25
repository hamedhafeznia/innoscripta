import type { Article } from '../../core/article';

/**
 * UTC throughout, matching the date filter. The APIs take whole dates with no timezone
 * and read them as UTC, so grouping by the reader's local day would put an article in a
 * heading outside the range they asked for.
 */
export function dayKey(article: Article): string {
  return article.publishedAt.slice(0, 10);
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_DAY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export function formatDay(key: string): string {
  return DAY_FORMAT.format(new Date(`${key}T12:00:00Z`));
}

export function formatShortDay(key: string): string {
  return SHORT_DAY.format(new Date(`${key}T12:00:00Z`));
}

export interface DayGroup {
  key: string;
  label: string;
  articles: Article[];
}

/** Articles arrive newest-first, so the groups come out newest-first too. */
export function groupByDay(articles: Article[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const article of articles) {
    const key = dayKey(article);
    const existing = groups.get(key);
    if (existing) existing.articles.push(article);
    else groups.set(key, { key, label: formatDay(key), articles: [article] });
  }

  return [...groups.values()];
}

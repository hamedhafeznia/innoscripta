import type { Article } from '../../core/article';
import type { Filters } from '../../core/filters';
import { dayKey, formatShortDay } from './day';

interface RangeProgressProps {
  filters: Filters;
  articles: Article[];
  /** Set when the range is being walked a day at a time: the next day Load more fetches. */
  nextDay?: string;
  hasMore: boolean;
}

/**
 * A range that is read newest-first looks broken from the inside: a busy day carries a
 * couple of hundred articles per source, so ten pages of a ten-day range can all belong
 * to the same day. This line says where in the range the reader actually is, and — when
 * the range is being walked — which day comes next.
 */
export function RangeProgress({ filters, articles, nextDay, hasMore }: RangeProgressProps) {
  if (!filters.from && !filters.to) return null;
  if (!articles.length) return null;

  const oldestLoaded = dayKey(articles[articles.length - 1]!);
  const range =
    filters.from && filters.to
      ? `${formatShortDay(filters.from)} to ${formatShortDay(filters.to)}`
      : filters.from
        ? `${formatShortDay(filters.from)} onwards`
        : `up to ${formatShortDay(filters.to!)}`;

  if (!hasMore) {
    return (
      <p className="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
        That is the whole range, {range}.
      </p>
    );
  }

  if (nextDay) {
    return (
      <p className="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
        The top of each day in {range}, newest first. Load more for {formatShortDay(nextDay)}.
      </p>
    );
  }

  return (
    <p className="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
      Newest first, back to {formatShortDay(oldestLoaded)} so far. Your range runs {range} — a busy
      day carries hundreds of articles, so load more to keep going back.
    </p>
  );
}

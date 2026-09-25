import type { Article } from '../../core/article';
import { Skeleton } from '@/components/ui/skeleton';
import { DaySection } from './DaySection';
import { groupByDay } from './day';
import { ARTICLE_GRID } from './layout';

/**
 * Grouped by day, always.
 *
 * A busy day carries ~200 articles per source, so ten pages of a ten-day range can all
 * belong to the same day. Ungrouped, that reads as a filter that did not work. The
 * heading says which day you are in, and it makes the newest-first merge — the thing the
 * whole query layer exists to do — visible instead of implied.
 *
 * Each day shows a handful and keeps the rest one click away, so the day after this one
 * is reachable by scrolling rather than by fetching.
 */
export function ArticleList({
  articles,
  collapseDays = false,
}: {
  articles: Article[];
  /** True when a range is being walked: every rendered day is finished and can collapse. */
  collapseDays?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-10">
      {groupByDay(articles).map((group) => (
        <DaySection key={group.key} group={group} collapsed={collapseDays} />
      ))}
    </div>
  );
}

/**
 * Mirrors the real card's shape — image, eyebrow, two headline lines, description, byline
 * — so nothing jumps when the articles arrive.
 */
export function ArticleListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="w-full" aria-hidden="true">
      <Skeleton className="mb-5 h-4 w-48" />
      <ul className={ARTICLE_GRID}>
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/2] w-full rounded-md" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-1/3" />
              <Skeleton className="h-5 w-[95%]" />
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="mt-1 h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

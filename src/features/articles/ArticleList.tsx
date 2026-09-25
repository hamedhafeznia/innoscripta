import type { Article } from '../../core/article';
import { Skeleton } from '@/components/ui/skeleton';
import { ArticleCard } from './ArticleCard';

/**
 * Wide gutters and a narrow column count: a reading grid, not a dashboard grid. The
 * vertical gap runs larger than the horizontal one so rows read as separate stories
 * rather than as a continuous wall.
 */
const GRID =
  'grid w-full list-none grid-cols-1 gap-x-7 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3';

export function ArticleList({ articles }: { articles: Article[] }) {
  return (
    <ul className={GRID}>
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleCard article={article} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Mirrors the real card's shape — image, eyebrow, two headline lines, description, byline
 * — so nothing jumps when the articles arrive.
 */
export function ArticleListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className={GRID} aria-hidden="true">
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
  );
}

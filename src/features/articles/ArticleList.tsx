import type { Article } from '../../core/article';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArticleCard } from './ArticleCard';

const GRID = 'grid w-full list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3';

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

export function ArticleListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Card className="flex h-full flex-col gap-0 overflow-hidden p-0">
            <Skeleton className="aspect-video w-full rounded-none" />
            <CardContent className="flex flex-col gap-2 px-3.5 py-3">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/5" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

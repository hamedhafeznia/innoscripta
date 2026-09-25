import type { Article } from '../../core/article';
import { ArticleCard } from './ArticleCard';

export function ArticleList({ articles }: { articles: Article[] }) {
  return (
    <ul className="card-grid">
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
    <ul className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <div className="card card-skeleton">
            <div className="card-image" />
            <div className="card-body">
              <span className="skeleton-line skeleton-line-short" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line-short" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

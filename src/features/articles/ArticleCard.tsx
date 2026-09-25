import type { Article } from '../../core/article';
import { SOURCES } from '../../sources/registry';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function providerLabel(article: Article): string {
  return SOURCES.find((source) => source.id === article.source)?.label ?? article.source;
}

export function ArticleCard({ article }: { article: Article }) {
  const published = new Date(article.publishedAt);

  return (
    <article className="card">
      {article.imageUrl ? (
        <img className="card-image" src={article.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="card-image card-image-empty" aria-hidden="true" />
      )}

      <div className="card-body">
        <p className="card-meta">
          {/* The publisher is who wrote it; the provider is which API we asked. */}
          <span className="card-publisher">{article.publisher ?? providerLabel(article)}</span>
          {article.sourceCategory ? <span className="card-chip">{article.sourceCategory}</span> : null}
          <time dateTime={article.publishedAt}>{DATE_FORMAT.format(published)}</time>
        </p>

        <h3 className="card-title">
          {/* Links out: none of these APIs reliably return full body text. */}
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            {article.title}
          </a>
        </h3>

        {article.description ? <p className="card-description">{article.description}</p> : null}

        {article.author ? <p className="card-author">{article.author}</p> : null}

        <p className="card-provider">via {providerLabel(article)}</p>
      </div>
    </article>
  );
}

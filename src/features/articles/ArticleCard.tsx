import type { Article } from '../../core/article';
import { SOURCES } from '../../sources/registry';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { FollowAuthorButton } from '../preferences/FollowAuthorButton';

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

  // A real <article> element rather than role="article" on Card's div.
  return (
    <article className="h-full">
      <Card className="flex h-full flex-col gap-0 overflow-hidden p-0">
        {article.imageUrl ? (
          <img
            className="aspect-video w-full bg-surface object-cover"
            src={article.imageUrl}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full bg-surface" aria-hidden="true" />
        )}

        <CardContent className="flex flex-col gap-2 px-3.5 py-3">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {/* The publisher is who wrote it; the provider is which API we asked. */}
            <span className="font-semibold text-foreground">
              {article.publisher ?? providerLabel(article)}
            </span>
            {article.sourceCategory ? (
              <Badge variant="secondary" className="font-normal">
                {article.sourceCategory}
              </Badge>
            ) : null}
            <time dateTime={article.publishedAt}>{DATE_FORMAT.format(published)}</time>
          </p>

          <h3 className="text-base leading-snug font-semibold">
            {/* Links out: none of these APIs reliably return full body text. */}
            <a
              className="hover:underline"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {article.title}
            </a>
          </h3>

          {article.description ? (
            <p className="text-sm text-muted-foreground">{article.description}</p>
          ) : null}

          {article.author ? (
            <p className="text-xs text-muted-foreground">{article.author}</p>
          ) : null}
        </CardContent>

        <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 px-3.5 pt-0 pb-3.5 text-xs text-muted-foreground">
          <span>via {providerLabel(article)}</span>
          <FollowAuthorButton article={article} />
        </CardFooter>
      </Card>
    </article>
  );
}

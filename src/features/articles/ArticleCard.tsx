import type { Article } from '../../core/article';
import { SOURCES } from '../../sources/registry';
import { FollowAuthorButton } from '../preferences/FollowAuthorButton';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function providerLabel(article: Article): string {
  return SOURCES.find((source) => source.id === article.source)?.label ?? article.source;
}

/**
 * The fallback when a source returns no thumbnail. It holds the grid's rhythm — every
 * card the same height, which is most of what makes a wall of cards feel calm — without
 * pretending to be a photograph: a tinted field and the publisher's initial in the
 * headline face, at a weight that recedes rather than competes.
 */
function ImageFallback({ publisher }: { publisher: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-surface ring-1 ring-foreground/8 ring-inset"
    >
      <span className="font-serif text-6xl leading-none font-light text-muted-foreground/25 select-none">
        {publisher.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

export function ArticleCard({ article }: { article: Article }) {
  const published = new Date(article.publishedAt);
  const provider = providerLabel(article);
  const publisher = article.publisher ?? provider;

  return (
    <article className="group flex h-full flex-col gap-3">
      {article.imageUrl ? (
        <img
          // A hairline inside the edge: without it a pale photograph dissolves into the
          // page and the grid loses its rhythm wherever the sky is white.
          className="aspect-[3/2] w-full rounded-md bg-surface object-cover ring-1 ring-foreground/8 ring-inset"
          src={article.imageUrl}
          alt=""
          loading="lazy"
        />
      ) : (
        <ImageFallback publisher={publisher} />
      )}

      <div className="flex flex-1 flex-col gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.7rem] text-muted-foreground">
          {/* The publisher is who wrote it; the provider is which API we asked. */}
          <span className="font-medium tracking-[0.08em] text-foreground uppercase">
            {publisher}
          </span>
          {article.sourceCategory ? (
            <span className="text-muted-foreground/80">{article.sourceCategory}</span>
          ) : null}
          {/* Tabular figures so a column of dates lines up instead of shimmering. */}
          <time className="tabular-nums" dateTime={article.publishedAt}>
            {DATE_FORMAT.format(published)}
          </time>
        </p>

        {/* Serif, tight, balanced: the headline is the only thing on the card allowed to
            be loud, and wrapping it evenly is what stops a grid looking ragged. */}
        <h2 className="font-serif text-[1.35rem] leading-[1.25] font-medium tracking-[-0.011em] text-balance break-words">
          {/* Links out: none of these APIs reliably return full body text. */}
          <a
            className="decoration-1 underline-offset-[3px] group-hover:underline focus-visible:underline"
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {article.title}
          </a>
        </h2>

        {article.description ? (
          <p className="line-clamp-3 text-[0.9rem] leading-relaxed text-muted-foreground">
            {article.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          {article.author ? (
            // A live blog can carry eight bylines; one line of them is context, three is noise.
            <p
              className="line-clamp-1 font-serif text-[0.85rem] text-muted-foreground italic"
              title={article.author}
            >
              {article.author}
            </p>
          ) : (
            <span />
          )}
          <FollowAuthorButton article={article} />
        </div>

        {/* Provenance only when it is surprising: "via NewsAPI" on an Irish Times story is
            information, "via The Guardian" on a Guardian story is furniture. */}
        {publisher !== provider ? (
          <p className="text-[0.7rem] text-muted-foreground/80">via {provider}</p>
        ) : null}
      </div>
    </article>
  );
}

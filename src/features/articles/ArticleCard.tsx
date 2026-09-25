import type { Article } from '../../core/article';
import { getSource } from '../../sources/registry';
import { FollowAuthorButton } from '../preferences/FollowAuthorButton';

/*
 * UTC, deliberately. The three APIs filter by whole dates with no timezone, which they
 * read as UTC, so a search for "3 to 6 September" is a UTC range. Formatting the card in
 * the reader's own zone makes an article published at 23:41Z on the 6th render as the 7th
 * for anyone east of London — a result dated outside the range the reader just asked for.
 * The day shown and the day filtered are now the same day.
 */
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The reader's own zone, with the time, kept on hover for when the exact moment matters. */
const EXACT_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'full',
  timeStyle: 'short',
});

function providerLabel(article: Article): string {
  return getSource(article.source)?.label ?? article.source;
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
      className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-md bg-surface outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
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
          // page and the grid loses its rhythm wherever the sky is white. Pure black and
          // pure white, never a tinted near-black — a tinted edge picks up the surface
          // beneath it and reads as dirt on the photograph.
          className="aspect-[3/2] w-full rounded-md bg-surface object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
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
          <time
            className="tabular-nums"
            dateTime={article.publishedAt}
            title={EXACT_FORMAT.format(published)}
          >
            {DATE_FORMAT.format(published)}
          </time>
        </p>

        {/* h3 under the day's h2, under the page's h1: a complete ladder with nothing
            skipped. Serif, tight, balanced — the headline is the only thing on the card
            allowed to be loud, and wrapping it evenly stops the grid looking ragged. */}
        <h3 className="font-serif text-[1.35rem] leading-[1.25] font-medium tracking-[-0.011em] text-balance break-words">
          {/* Links out: none of these APIs reliably return full body text, so there is no
              detail page to open — the "Read at" link below says so on the card itself. */}
          <a
            className="decoration-1 underline-offset-[3px] group-hover:underline focus-visible:underline"
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {article.title}
          </a>
        </h3>

        {article.description ? (
          <p className="line-clamp-3 text-[0.9rem] leading-relaxed text-pretty text-muted-foreground">
            {article.description}
          </p>
        ) : null}

        {/* The headline and this link share a destination. The headline is the natural click;
            this one says where it leads, so leaving the app is expected, not a surprise. */}
        <a
          className="w-fit text-[0.8rem] font-medium text-brand underline-offset-[3px] hover:underline focus-visible:underline"
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Read at ${publisher}: ${article.title}`}
        >
          Read at {publisher} <span aria-hidden="true">↗</span>
        </a>

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

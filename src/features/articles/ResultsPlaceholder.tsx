import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultsPlaceholderProps {
  /** Nothing answered at all — not the same thing as an empty result set. */
  unreachable: boolean;
  /** Client-side filtering ran out of pages before it found a match. */
  outOfMatches: boolean;
  /** What to say when the sources answered and simply had nothing. */
  emptyMessage: string;
  onRetry: () => void;
  isRetrying: boolean;
}

/**
 * The three ways a page can come back with no articles, which are not interchangeable:
 * nothing was reachable, nothing matched yet, or nothing matched at all. Telling a reader
 * there are "no more matches" when no source was even reached is a lie, and offering to
 * load more of them is a lie that costs requests.
 *
 * Shared by both routes so the distinction cannot drift between them.
 */
export function ResultsPlaceholder({
  unreachable,
  outOfMatches,
  emptyMessage,
  onRetry,
  isRetrying,
}: ResultsPlaceholderProps) {
  if (unreachable) {
    return (
      <div
        role="alert"
        className="flex w-full flex-col items-center gap-3 rounded-lg border bg-surface/60 px-6 py-12 text-center"
      >
        <p className="m-0 font-serif text-xl font-medium">No source could be reached.</p>
        <p className="m-0 max-w-prose text-sm text-pretty text-muted-foreground">
          Nothing was searched, so there are no results to show — not even an empty one. The
          notices above say what each source reported.
        </p>
        <Button type="button" variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RotateCw className={isRetrying ? 'animate-spin' : undefined} />
          {isRetrying ? 'Trying again…' : 'Try again'}
        </Button>
      </div>
    );
  }

  return (
    <p className="m-0 w-full rounded-lg border border-dashed bg-surface/50 px-6 py-12 text-center font-serif text-[1.05rem] text-muted-foreground">
      {outOfMatches
        ? 'Nothing matched in the pages checked so far. Load more to keep looking.'
        : emptyMessage}
    </p>
  );
}

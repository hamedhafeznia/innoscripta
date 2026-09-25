import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LoadMoreProps {
  hasNextPage: boolean;
  /** The last fan-out reached no source at all. */
  unreachable: boolean;
  /** Whether the list above has anything in it; an empty list is the placeholder's job. */
  hasArticles: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/**
 * The foot of a result list. Three different truths, and only one of them is "that is
 * everything": there is more to load, the next page could not be reached and is worth
 * another try, or the sources really have nothing further.
 *
 * Explicit Load more rather than infinite scroll: paging costs real requests.
 */
export function LoadMore({
  hasNextPage,
  unreachable,
  hasArticles,
  isFetchingNextPage,
  onLoadMore,
}: LoadMoreProps) {
  if (hasNextPage && !unreachable) {
    return (
      <Button
        type="button"
        variant="outline"
        // Quiet: on a page of photographs and serif headlines a filled accent button is
        // the loudest thing on screen, and it is not the most important one.
        className="mx-auto h-11 min-w-56 font-medium"
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading…' : 'Load more'}
      </Button>
    );
  }

  if (!hasArticles) return null;

  if (hasNextPage) {
    // Nothing answered, so the list is not finished — it is just not loading. The cursor
    // has not moved, so trying again asks for exactly the page that failed.
    return (
      <div
        role="alert"
        className="flex w-full flex-col items-center gap-3 border-t pt-6 text-center"
      >
        <p className="m-0 font-serif text-[0.95rem] text-muted-foreground italic">
          No source could be reached to load more. The notices above say what each reported.
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-56 font-medium"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
        >
          <RotateCw className={isFetchingNextPage ? 'animate-spin' : undefined} />
          {isFetchingNextPage ? 'Trying again…' : 'Try again'}
        </Button>
      </div>
    );
  }

  return (
    <p className="m-0 w-full border-t pt-6 text-center font-serif text-[0.95rem] text-muted-foreground italic">
      That is everything these sources have for this search.
    </p>
  );
}

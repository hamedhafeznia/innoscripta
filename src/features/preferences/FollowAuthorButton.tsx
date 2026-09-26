import type { Article } from '../../core/article';
import { Button } from '@/components/ui/button';
import { primaryAuthor, useIsFollowing, usePreferences } from './store';

/**
 * A follow is a property of the reader, not a predicate on a query, so it lives in
 * localStorage rather than the URL. Following narrows the feed to that author's articles
 * (OR-ed with the other followed authors), within the chosen providers and categories.
 */
export function FollowAuthorButton({ article }: { article: Article }) {
  const name = primaryAuthor(article);
  const following = useIsFollowing(article);
  const followAuthor = usePreferences((state) => state.followAuthor);
  const unfollowAuthor = usePreferences((state) => state.unfollowAuthor);

  if (!name) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={following ? 'rounded-full border-primary text-primary' : 'rounded-full'}
      aria-pressed={following}
      onClick={() => (following ? unfollowAuthor(name) : followAuthor(article))}
    >
      {following ? `Following ${name}` : `Follow ${name}`}
    </Button>
  );
}

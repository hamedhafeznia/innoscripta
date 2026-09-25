import type { Article } from '../../core/article';
import { primaryAuthor, useIsFollowing, usePreferences } from './store';

/**
 * A follow is a property of the reader, not a predicate on a query, so it lives in
 * localStorage rather than the URL — and it widens the feed rather than narrowing it.
 */
export function FollowAuthorButton({ article }: { article: Article }) {
  const name = primaryAuthor(article);
  const following = useIsFollowing(article);
  const followAuthor = usePreferences((state) => state.followAuthor);
  const unfollowAuthor = usePreferences((state) => state.unfollowAuthor);

  if (!name) return null;

  return (
    <button
      type="button"
      className={following ? 'follow follow-on' : 'follow'}
      aria-pressed={following}
      onClick={() => (following ? unfollowAuthor(name) : followAuthor(article))}
    >
      {following ? `Following ${name}` : `Follow ${name}`}
    </button>
  );
}

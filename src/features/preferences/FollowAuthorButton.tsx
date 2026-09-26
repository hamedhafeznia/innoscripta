import { UserCheck, UserPlus } from 'lucide-react';
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
      // Following is the one action on a card that builds something, so it should read as
      // an action rather than as caption text: brand-coloured while it invites, filled
      // once it is done. The filled state is what tells a reader at a glance whom they
      // already follow.
      variant={following ? 'default' : 'outline'}
      size="sm"
      className={
        following
          ? 'max-w-full min-w-0 rounded-full'
          : 'max-w-full min-w-0 rounded-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary'
      }
      aria-pressed={following}
      onClick={() => (following ? unfollowAuthor(name) : followAuthor(article))}
    >
      {following ? <UserCheck /> : <UserPlus />}
      {/* Names run long ("Muktita Suhartono, Ulet Ifansasti" is two of them); the button
          shrinks and truncates rather than pushing the card wider. */}
      <span className="truncate">{following ? `Following ${name}` : `Follow ${name}`}</span>
    </Button>
  );
}

import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArticleCard } from './ArticleCard';
import type { DayGroup } from './day';

/** Two clean rows on a three-column grid, and the next day reachable by scrolling. */
const VISIBLE_PER_DAY = 6;

const GRID =
  'grid w-full list-none grid-cols-1 gap-x-7 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3';

export function DaySection({ group, collapsed }: { group: DayGroup; collapsed: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // Only a finished day collapses. While paging into a day, Load more keeps adding to it,
  // and a cap would swallow exactly the articles the reader just asked for.
  const capped = collapsed && !expanded;
  const hidden = capped ? group.articles.length - VISIBLE_PER_DAY : 0;
  const visible = capped ? group.articles.slice(0, VISIBLE_PER_DAY) : group.articles;

  return (
    <section aria-labelledby={`${listId}-heading`}>
      <h2
        id={`${listId}-heading`}
        className="mb-5 border-b pb-2 font-serif text-[0.95rem] font-medium tracking-[0.01em] text-muted-foreground"
      >
        {/* The door into a single day. A one-day range pages into that day instead of
            walking, so this is how a reader gets past the slice we fetched. */}
        <Link
          className="underline-offset-4 hover:text-foreground hover:underline"
          to={{ pathname: '/search', search: `from=${group.key}&to=${group.key}` }}
        >
          {group.label}
        </Link>
      </h2>

      <ul id={listId} className={GRID}>
        {visible.map((article) => (
          <li key={article.id}>
            <ArticleCard article={article} />
          </li>
        ))}
      </ul>

      {/* Free: these articles are already fetched and in memory. Revealing them costs
          nothing against the request budget, unlike walking to another day. */}
      {hidden > 0 && !expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-5 text-muted-foreground"
          aria-expanded={false}
          aria-controls={listId}
          onClick={() => setExpanded(true)}
        >
          Show {hidden} more from {group.label}
        </Button>
      ) : null}
    </section>
  );
}

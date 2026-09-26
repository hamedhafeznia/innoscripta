import { X } from 'lucide-react';
import { CATEGORIES } from '../../core/article';
import { SOURCES } from '../../sources/registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckboxChip } from '@/components/CheckboxChip';
import { usePreferences } from './store';

/**
 * The feed's controls. Unlike `/search`, none of this goes in the URL: it is who the
 * reader is, not what they asked for once, so it persists to localStorage instead.
 */
export function PreferencesPanel() {
  const { categories, sources, authors, toggleCategory, toggleSource, unfollowAuthor, clear } =
    usePreferences();

  const hasAny = categories.length > 0 || sources.length > 0 || authors.length > 0;

  return (
    <section aria-label="Feed preferences" className="flex w-full flex-col gap-4 border-b pb-6">
      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-2 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Categories I follow
        </legend>
        {CATEGORIES.map((category) => (
          <CheckboxChip
            key={category}
            label={category}
            checked={categories.includes(category)}
            onToggle={() => toggleCategory(category)}
            className="bg-background"
          />
        ))}
      </fieldset>

      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-2 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Providers I read
        </legend>
        {SOURCES.map((source) => (
          <CheckboxChip
            key={source.id}
            label={source.label}
            checked={sources.includes(source.id)}
            onToggle={() => toggleSource(source.id)}
            className="bg-background"
          />
        ))}
      </fieldset>

      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-2 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Authors I follow
        </legend>
        {authors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            None yet — follow an author from any result in search.
          </p>
        ) : (
          authors.map((author) => (
            <Badge
              key={author.name}
              variant="outline"
              className="max-w-full gap-1 bg-background py-1 pr-1"
            >
              <span className="truncate">{author.name}</span>
              <Button
                type="button"
                variant="ghost"
                // icon-sm over icon-xs: 24px is too small to hit. A pseudo-element could
                // reach 44px but would collide with the neighbouring chip 8px away, so the
                // control grows instead.
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                onClick={() => unfollowAuthor(author.name)}
                aria-label={`Unfollow ${author.name}`}
              >
                <X />
              </Button>
            </Badge>
          ))
        )}
      </fieldset>

      {hasAny ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={clear}
        >
          Clear preferences
        </Button>
      ) : null}
    </section>
  );
}

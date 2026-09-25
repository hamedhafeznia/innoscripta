import { CATEGORIES, type Category, type SourceId } from '../../core/article';
import type { Filters } from '../../core/filters';
import { SOURCES } from '../../sources/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckboxChip } from '../articles/CheckboxChip';
import { DateRangeField } from './DateRangeField';

interface FilterBarProps {
  filters: Filters;
  /** Inside the mobile sheet the surrounding panel is the sheet itself; a second
   *  bordered card inside it is a box in a box with doubled padding. */
  bare?: boolean;
  /** Uncontrolled from the URL's point of view: it updates only after the debounce. */
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onChange: (filters: Filters) => void;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterBar({ filters, keyword, onKeywordChange, onChange, bare }: FilterBarProps) {
  const hasFilters =
    Boolean(filters.query || filters.from || filters.to) ||
    filters.categories.length > 0 ||
    filters.sources.length > 0;

  return (
    <form
      role="search"
      // A hairline toolbar, not a filled panel: on a reading page the filters are how you
      // get to the news, and a slab of tinted card above the fold makes them the subject.
      className={
        bare ? 'flex w-full flex-col gap-5' : 'flex w-full flex-col gap-4 border-b pb-6'
      }
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-wrap gap-3">
        {/* `min-w-0` with a basis rather than a min width: at 320px a 16rem minimum is
            exactly the space available, so any padding change would overflow the page. */}
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Search
          </span>
          <Input
            type="search"
            name="q"
            value={keyword}
            placeholder="Keywords, e.g. climate"
            className="bg-background"
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </label>

        <DateRangeField
          label="From"
          value={filters.from}
          max={filters.to}
          onChange={(from) => onChange({ ...filters, from })}
        />
        <DateRangeField
          label="To"
          value={filters.to}
          min={filters.from}
          onChange={(to) => onChange({ ...filters, to })}
        />
      </div>

      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        <legend className="mb-2 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Categories
        </legend>
        {CATEGORIES.map((category: Category) => (
          <CheckboxChip
            key={category}
            label={category}
            checked={filters.categories.includes(category)}
            onToggle={() => onChange({ ...filters, categories: toggle(filters.categories, category) })}
            className="bg-background"
          />
        ))}
      </fieldset>

      <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0">
        {/* Providers, not publishers: this picks which API we ask, not who wrote it. */}
        <legend className="mb-2 text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Providers
        </legend>
        {SOURCES.map((source) => (
          <CheckboxChip
            key={source.id}
            label={source.label}
            checked={filters.sources.includes(source.id)}
            onToggle={() => onChange({ ...filters, sources: toggle(filters.sources, source.id as SourceId) })}
            className="bg-background"
          />
        ))}
      </fieldset>

      {hasFilters ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => {
            onKeywordChange('');
            onChange({ query: '', categories: [], sources: [] });
          }}
        >
          Clear filters
        </Button>
      ) : null}
    </form>
  );
}

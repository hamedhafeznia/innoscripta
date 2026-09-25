import { CATEGORIES, type Category, type SourceId } from '../../core/article';
import type { Filters } from '../../core/filters';
import { SOURCES } from '../../sources/registry';

interface FilterBarProps {
  filters: Filters;
  /** Uncontrolled from the URL's point of view: it updates only after the debounce. */
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onChange: (filters: Filters) => void;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterBar({ filters, keyword, onKeywordChange, onChange }: FilterBarProps) {
  const hasFilters =
    Boolean(filters.query || filters.from || filters.to) ||
    filters.categories.length > 0 ||
    filters.sources.length > 0;

  return (
    <form className="filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <div className="filter-row">
        <label className="field field-grow">
          <span className="field-label">Search</span>
          <input
            type="search"
            name="q"
            value={keyword}
            placeholder="Keywords, e.g. climate"
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">From</span>
          <input
            type="date"
            name="from"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(event) => onChange({ ...filters, from: event.target.value || undefined })}
          />
        </label>

        <label className="field">
          <span className="field-label">To</span>
          <input
            type="date"
            name="to"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(event) => onChange({ ...filters, to: event.target.value || undefined })}
          />
        </label>
      </div>

      <fieldset className="filter-group">
        <legend>Categories</legend>
        {CATEGORIES.map((category: Category) => (
          <label key={category} className="chip">
            <input
              type="checkbox"
              checked={filters.categories.includes(category)}
              onChange={() => onChange({ ...filters, categories: toggle(filters.categories, category) })}
            />
            <span>{category}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        {/* Providers, not publishers: this picks which API we ask, not who wrote it. */}
        <legend>Providers</legend>
        {SOURCES.map((source) => (
          <label key={source.id} className="chip">
            <input
              type="checkbox"
              checked={filters.sources.includes(source.id)}
              onChange={() =>
                onChange({ ...filters, sources: toggle(filters.sources, source.id as SourceId) })
              }
            />
            <span>{source.label}</span>
          </label>
        ))}
      </fieldset>

      {hasFilters ? (
        <button
          type="button"
          className="button-quiet"
          onClick={() => {
            onKeywordChange('');
            onChange({ query: '', categories: [], sources: [] });
          }}
        >
          Clear filters
        </button>
      ) : null}
    </form>
  );
}

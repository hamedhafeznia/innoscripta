import { CATEGORIES } from '../../core/article';
import { SOURCES } from '../../sources/registry';
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
    <section className="filters" aria-label="Feed preferences">
      <fieldset className="filter-group">
        <legend>Categories I follow</legend>
        {CATEGORIES.map((category) => (
          <label key={category} className="chip">
            <input
              type="checkbox"
              checked={categories.includes(category)}
              onChange={() => toggleCategory(category)}
            />
            <span>{category}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Providers I read</legend>
        {SOURCES.map((source) => (
          <label key={source.id} className="chip">
            <input
              type="checkbox"
              checked={sources.includes(source.id)}
              onChange={() => toggleSource(source.id)}
            />
            <span>{source.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Authors I follow</legend>
        {authors.length === 0 ? (
          <p className="field-label">
            None yet — use “Follow” on any article card to add one.
          </p>
        ) : (
          authors.map((author) => (
            <span key={author.name} className="chip">
              {author.name}
              <button
                type="button"
                className="notice-dismiss"
                onClick={() => unfollowAuthor(author.name)}
                aria-label={`Unfollow ${author.name}`}
              >
                &times;
              </button>
            </span>
          ))
        )}
      </fieldset>

      {hasAny ? (
        <button type="button" className="button-quiet" onClick={clear}>
          Clear preferences
        </button>
      ) : null}
    </section>
  );
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Article, Category, SourceId } from '../../core/article';

/**
 * A followed author is one person, remembered across sessions. `ref` is the source's
 * own identifier for them where one exists (the Guardian's contributor tag), which is
 * what allows the filter to run server-side instead of after the fetch.
 */
export interface FollowedAuthor {
  name: string;
  ref: string | null;
}

export interface Preferences {
  categories: Category[];
  sources: SourceId[];
  authors: FollowedAuthor[];
}

interface PreferencesStore extends Preferences {
  toggleCategory: (category: Category) => void;
  toggleSource: (source: SourceId) => void;
  followAuthor: (article: Article) => void;
  unfollowAuthor: (name: string) => void;
  clear: () => void;
}

/** Follows are matched case-insensitively: the same person, however a source cased them. */
const sameAuthor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The display byline may list several people; the first is the one a follow is about. */
export function primaryAuthor(article: Article): string | null {
  return article.author?.split(',')[0]?.trim() || null;
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export const usePreferences = create<PreferencesStore>()(
  persist(
    (set) => ({
      categories: [],
      sources: [],
      authors: [],

      toggleCategory: (category) =>
        set((state) => ({ categories: toggle(state.categories, category) })),

      toggleSource: (source) => set((state) => ({ sources: toggle(state.sources, source) })),

      followAuthor: (article) =>
        set((state) => {
          const name = primaryAuthor(article);
          if (!name) return state;

          const existing = state.authors.find((author) => sameAuthor(author.name, name));
          // Re-following from a Guardian card upgrades a name-only follow with its ref.
          if (existing) {
            if (existing.ref || !article.authorRef) return state;
            return {
              authors: state.authors.map((author) =>
                sameAuthor(author.name, name) ? { ...author, ref: article.authorRef } : author,
              ),
            };
          }

          return { authors: [...state.authors, { name, ref: article.authorRef }] };
        }),

      unfollowAuthor: (name) =>
        set((state) => ({
          authors: state.authors.filter((author) => !sameAuthor(author.name, name)),
        })),

      clear: () => set({ categories: [], sources: [], authors: [] }),
    }),
    {
      name: 'innoscripta.preferences',
      version: 1,
      // Only the data persists; the actions are rebuilt from the module on every load.
      partialize: ({ categories, sources, authors }) => ({ categories, sources, authors }),
    },
  ),
);

/** True when the article's primary author is already followed. */
export function useIsFollowing(article: Article): boolean {
  const name = primaryAuthor(article);
  return usePreferences((state) =>
    name ? state.authors.some((author) => sameAuthor(author.name, name)) : false,
  );
}

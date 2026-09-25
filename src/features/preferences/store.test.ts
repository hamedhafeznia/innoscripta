import { makeArticle } from '../../core/testArticle';
import { usePreferences } from './store';

const article = (author: string | null, authorRef: string | null = null) =>
  makeArticle({ publishedAt: '2026-09-24T00:00:00Z', author, authorRef });

describe('preferences store', () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferences.getState().clear();
  });

  it('toggles a category on and off again', () => {
    const { toggleCategory } = usePreferences.getState();

    toggleCategory('science');
    expect(usePreferences.getState().categories).toEqual(['science']);

    toggleCategory('science');
    expect(usePreferences.getState().categories).toEqual([]);
  });

  describe('following an author', () => {
    it('follows the first name of a multi-name byline', () => {
      usePreferences.getState().followAuthor(article('Muktita Suhartono, Ulet Ifansasti'));

      expect(usePreferences.getState().authors).toEqual([
        { name: 'Muktita Suhartono', ref: null },
      ]);
    });

    it('keeps the source identifier when the card carried one', () => {
      usePreferences.getState().followAuthor(article('Lucy Campbell', 'profile/lucy-campbell'));

      expect(usePreferences.getState().authors[0]).toEqual({
        name: 'Lucy Campbell',
        ref: 'profile/lucy-campbell',
      });
    });

    it('upgrades a name-only follow when the same author turns up with an identifier', () => {
      // Followed from an NYT card first, then seen on a Guardian one: the identifier
      // is what lets the Guardian filter server-side, so it is worth picking up.
      const { followAuthor } = usePreferences.getState();

      followAuthor(article('Lucy Campbell'));
      followAuthor(article('Lucy Campbell', 'profile/lucy-campbell'));

      expect(usePreferences.getState().authors).toEqual([
        { name: 'Lucy Campbell', ref: 'profile/lucy-campbell' },
      ]);
    });

    it('does not follow the same person twice, whatever the casing', () => {
      const { followAuthor } = usePreferences.getState();

      followAuthor(article('Lucy Campbell'));
      followAuthor(article('lucy campbell'));

      expect(usePreferences.getState().authors).toHaveLength(1);
    });

    it('ignores an article with no byline to follow', () => {
      usePreferences.getState().followAuthor(article(null));

      expect(usePreferences.getState().authors).toEqual([]);
    });

    it('unfollows regardless of casing', () => {
      usePreferences.getState().followAuthor(article('Lucy Campbell'));
      usePreferences.getState().unfollowAuthor('LUCY CAMPBELL');

      expect(usePreferences.getState().authors).toEqual([]);
    });
  });

  it('persists preferences to localStorage so they survive a reload', async () => {
    usePreferences.getState().toggleCategory('science');
    usePreferences.getState().followAuthor(article('Lucy Campbell', 'profile/lucy-campbell'));

    const stored = JSON.parse(localStorage.getItem('innoscripta.preferences') ?? '{}');

    expect(stored.state).toMatchObject({
      categories: ['science'],
      authors: [{ name: 'Lucy Campbell', ref: 'profile/lucy-campbell' }],
    });
    // Actions are rebuilt from the module; only the data is written.
    expect(stored.state.followAuthor).toBeUndefined();
  });
});

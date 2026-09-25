/**
 * Wide gutters and a narrow column count: a reading grid, not a dashboard grid. The
 * vertical gap runs larger than the horizontal one so rows read as separate stories
 * rather than as a continuous wall. One definition, so the skeleton and the real list
 * cannot drift apart and make the page jump when the articles arrive.
 */
export const ARTICLE_GRID =
  'grid w-full list-none grid-cols-1 gap-x-7 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3';

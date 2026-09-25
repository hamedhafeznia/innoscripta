import { z } from 'zod';

/**
 * The boundary between "whatever an API sent" and "an Article the rest of the app can
 * trust". Three providers, three shapes, and none of them promises what it sends: a date
 * that will not parse throws a RangeError in a card, and a `javascript:` URL is an
 * injection waiting for an `href`. Each adapter declares the fields an article cannot do
 * without and validates every item against them here, so nothing past this file has to
 * wonder.
 */

/** The URL back if it is http(s), otherwise null. Nothing else belongs in an href or src. */
export function asHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** A link we are willing to send the reader to. */
export const httpUrl = z.string().refine((value) => asHttpUrl(value) !== null, 'not an http(s) URL');

/** Anything `Date` can read. What the merge sorts and the card formats depends on it. */
export const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'not a date');

/** A required, non-blank string: a headline of nothing is not an article. */
export const requiredText = z.string().trim().min(1);

/**
 * An optional text field. A wrong type here costs the article a byline, not its place in
 * the list, so it degrades to "absent" instead of failing the whole item.
 */
export const optionalText = z.string().nullish().catch(undefined);

/**
 * Validates each item on its own and keeps the ones that pass. One malformed article must
 * cost one article, never the page.
 */
export function keepValid<S extends z.ZodType>(schema: S, items: readonly unknown[]): z.output<S>[] {
  return items.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

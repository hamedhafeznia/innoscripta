import { z } from 'zod';
import { CATEGORIES, type Category, type SourceId } from './article';
import { SOURCE_IDS } from '../sources/registry';

/**
 * The one filter object the whole app speaks. `/search` parses it out of the URL and
 * `/feed` derives it from stored preferences; both hand the same shape to the same hook.
 */
export interface Filters {
  query: string;
  /** `YYYY-MM-DD`, or absent. */
  from?: string;
  to?: string;
  /** AND-ed with `sources` and with the keyword. */
  categories: Category[];
  /** Providers to run, not publishers. Empty means every registered source. */
  sources: SourceId[];
}

export const EMPTY_FILTERS: Filters = { query: '', categories: [], sources: [] };

/**
 * `2026-02-31` matches the shape but is not a day, so the round trip is checked too.
 *
 * The check is total rather than relying on the regex having already rejected the value:
 * zod runs every check on a field, so a refinement that can throw escapes `.catch()`
 * and takes the whole parse down with it — which is exactly what must not happen to
 * input that arrives from the URL bar.
 */
function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

const isoDate = z.string().refine(isRealIsoDate);

/** Splits `a,b,b,z` into known members only: unknown values are dropped, not rejected. */
function csvOf<T extends string>(allowed: readonly T[]) {
  return z
    .string()
    .transform((value) =>
      [...new Set(value.split(',').map((part) => part.trim()))].filter((part): part is T =>
        (allowed as readonly string[]).includes(part),
      ),
    );
}

/**
 * The URL is untrusted input: anything a person can type, a stale bookmark can hold, or
 * another site can link to. Every field falls back to its empty value rather than
 * throwing, so a mangled URL renders an unfiltered page instead of a blank screen.
 */
const searchParamsSchema = z.object({
  q: z.string().trim().max(200).catch('').default(''),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  cat: csvOf(CATEGORIES).catch([]).default([]),
  src: csvOf(SOURCE_IDS as readonly SourceId[]).catch([]).default([]),
});

export function parseFilters(search: URLSearchParams | string): Filters {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;

  const raw = {
    q: params.get('q') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    cat: params.get('cat') ?? undefined,
    src: params.get('src') ?? undefined,
  };

  const parsed = searchParamsSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_FILTERS;

  const { q, cat, src } = parsed.data;
  let { from, to } = parsed.data;
  // A range typed or bookmarked back to front means the same two days. Left alone, the
  // day walk would read only `to` and report the whole range as finished.
  if (from && to && from > to) [from, to] = [to, from];

  return { query: q, from, to, categories: cat, sources: src };
}

/** The inverse. Empty values are omitted so the URL stays readable and shareable. */
export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.categories.length) params.set('cat', filters.categories.join(','));
  if (filters.sources.length) params.set('src', filters.sources.join(','));
  return params;
}

import type { NewsSource } from '../core/source';
import { guardianSource } from './guardian';
import { nytSource } from './nyt';
import { newsapiSource } from './newsapi';

/**
 * Registry order is also the collision tie-break in the merge: when two sources carry
 * the same story and neither copy is richer, the one listed first wins.
 *
 * Adding a source is one new adapter file and one line here. Nothing in the UI or the
 * query layer knows the list; both read each source's capability descriptor instead.
 */
const registered = [guardianSource, nytSource, newsapiSource] as const;

/**
 * Read off the registry, not written out anywhere: the ids a source can have are exactly
 * the ids of the sources registered here. This is what makes "one adapter file and one
 * registry line" the whole of adding a source.
 */
export type SourceId = (typeof registered)[number]['id'];

export const SOURCES: readonly NewsSource[] = registered;

export const SOURCE_IDS: readonly SourceId[] = SOURCES.map((source) => source.id);

export function getSource(id: SourceId): NewsSource | undefined {
  return SOURCES.find((source) => source.id === id);
}

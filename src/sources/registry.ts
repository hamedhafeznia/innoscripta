import type { SourceId } from '../core/article';
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
export const SOURCES: readonly NewsSource[] = [guardianSource, nytSource, newsapiSource];

export const SOURCE_IDS = SOURCES.map((source) => source.id);

export function getSource(id: SourceId): NewsSource | undefined {
  return SOURCES.find((source) => source.id === id);
}

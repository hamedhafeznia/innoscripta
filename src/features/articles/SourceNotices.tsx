import { useState } from 'react';
import type { SourceNotice } from '../query/types';

const KIND_LABEL: Record<SourceNotice['kind'], string> = {
  excluded: 'Left out',
  caveat: 'Note',
  error: 'Unavailable',
};

/**
 * One slot for all three kinds of per-source trouble: an unserviceable filter
 * combination, a narrowed answer, and an outright failure. Each is dismissible,
 * because a reviewer who has read it once should not have to read it on every page.
 */
export function SourceNotices({ notices }: { notices: SourceNotice[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = notices.filter((notice) => !dismissed.includes(notice.id));

  if (!visible.length) return null;

  return (
    <ul className="notices" aria-label="Source notices">
      {visible.map((notice) => (
        <li key={notice.id} className={`notice notice-${notice.kind}`}>
          <span className="notice-kind">{KIND_LABEL[notice.kind]}</span>
          <span className="notice-body">
            <strong>{notice.sourceLabel}</strong> {notice.message}
          </span>
          <button
            type="button"
            className="notice-dismiss"
            onClick={() => setDismissed((current) => [...current, notice.id])}
            aria-label={`Dismiss notice about ${notice.sourceLabel}`}
          >
            &times;
          </button>
        </li>
      ))}
    </ul>
  );
}

import { useState } from 'react';
import { AlertTriangle, Info, X, ZapOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { SourceNotice } from '../query/types';

const KIND = {
  excluded: { icon: ZapOff, tone: 'text-warning' },
  caveat: { icon: Info, tone: 'text-muted-foreground' },
  error: { icon: AlertTriangle, tone: 'text-destructive' },
} as const;

interface Grouped {
  id: string;
  kind: SourceNotice['kind'];
  message: string;
  sources: string[];
}

/** "A", "A and B", "A, B and C" — the sources share one sentence, not one each. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * Notices that say the same thing about different sources are one notice. Three stacked
 * rows of "Rejected the API key" is the same single fact read three times, and it buries
 * the page's actual state under repetition.
 */
function group(notices: SourceNotice[]): Grouped[] {
  const groups = new Map<string, Grouped>();

  for (const notice of notices) {
    const key = `${notice.kind}:${notice.message}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sources.push(notice.sourceLabel);
    } else {
      groups.set(key, {
        id: key,
        kind: notice.kind,
        message: notice.message,
        sources: [notice.sourceLabel],
      });
    }
  }

  return [...groups.values()];
}

/**
 * One slot for all three kinds of per-source trouble: an unserviceable filter
 * combination, a narrowed answer, and an outright failure. Each is dismissible,
 * because a reader who has read it once should not have to read it on every page.
 */
export function SourceNotices({ notices }: { notices: SourceNotice[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = group(notices).filter((notice) => !dismissed.includes(notice.id));

  if (!visible.length) return null;

  return (
    <ul aria-label="Source notices" className="flex w-full list-none flex-col gap-2 p-0">
      {visible.map((notice) => {
        const { icon: Icon, tone } = KIND[notice.kind];

        return (
          <li key={notice.id}>
            <Alert
              // Alert hard-codes role="alert", which is assertive. A failure earns that;
              // a dismissible caveat about narrowed results does not, so it is announced
              // politely instead.
              role={notice.kind === 'error' ? 'alert' : 'status'}
              className="items-center border-border/70 bg-transparent px-4 py-2.5"
            >
              <Icon className={tone} strokeWidth={1.5} />
              <AlertDescription className="pr-7 text-[0.85rem] text-pretty text-muted-foreground">
                <span>
                  <strong className="font-medium text-foreground">
                    {listNames(notice.sources)}
                  </strong>{' '}
                  {notice.message}
                </span>
              </AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                // rounded-sm, not the button default: the alert is 10px with the control
                // inset 6px, so a concentric inner corner is 4px.
                className="absolute top-1.5 right-1.5 rounded-sm text-muted-foreground"
                onClick={() => setDismissed((current) => [...current, notice.id])}
                aria-label={`Dismiss notice about ${listNames(notice.sources)}`}
              >
                <X />
              </Button>
            </Alert>
          </li>
        );
      })}
    </ul>
  );
}

import { useState } from 'react';
import { AlertTriangle, Info, X, ZapOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { SourceNotice } from '../query/types';

const KIND = {
  excluded: { label: 'Left out', icon: ZapOff, accent: 'border-l-warning' },
  caveat: { label: 'Note', icon: Info, accent: 'border-l-muted-foreground' },
  error: { label: 'Unavailable', icon: AlertTriangle, accent: 'border-l-destructive' },
} as const;

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
    <ul aria-label="Source notices" className="flex w-full list-none flex-col gap-2 p-0">
      {visible.map((notice) => {
        const { label, icon: Icon, accent } = KIND[notice.kind];

        return (
          <li key={notice.id}>
            <Alert
              // Alert hard-codes role="alert", which is assertive. A failure earns that;
              // a dismissible caveat does not, so it is announced politely instead.
              role={notice.kind === 'error' ? 'alert' : 'status'}
              variant={notice.kind === 'error' ? 'destructive' : 'default'}
              className={`border-l-[3px] bg-surface ${accent}`}
            >
              <Icon />
              <AlertDescription className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-6 text-foreground">
                <span className="text-xs tracking-wide text-muted-foreground uppercase">
                  {label}
                </span>
                <span>
                  <strong className="font-semibold">{notice.sourceLabel}</strong> {notice.message}
                </span>
              </AlertDescription>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-2 right-2 text-muted-foreground"
                onClick={() => setDismissed((current) => [...current, notice.id])}
                aria-label={`Dismiss notice about ${notice.sourceLabel}`}
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

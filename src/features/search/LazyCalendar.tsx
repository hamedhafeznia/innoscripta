import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * react-day-picker and date-fns are ~190 kB of the bundle and matter only once somebody
 * opens the date picker. The popover mounts its content lazily anyway, so this turns that
 * into a lazy *download* too, and the first paint no longer pays for a calendar.
 */
const Calendar = lazy(async () => ({
  default: (await import('@/components/ui/calendar')).Calendar,
}));

export function LazyCalendar(props: React.ComponentProps<typeof Calendar>) {
  return (
    <Suspense fallback={<Skeleton className="m-3 h-[17.5rem] w-[15rem]" />}>
      <Calendar {...props} />
    </Suspense>
  );
}

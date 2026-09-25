import { useId } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LazyCalendar } from './LazyCalendar';

/** `YYYY-MM-DD` in local terms, which is what every adapter expects to be handed. */
function toIsoDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromIsoDay(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

const LABEL_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

interface DateRangeFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  min?: string;
  max?: string;
}

/**
 * A Popover + Calendar in place of `<input type="date">`. The native control renders
 * differently in every browser and cannot express the min/max relationship between the
 * two ends of the range as clearly; here the other end is simply not selectable.
 */
export function DateRangeField({ label, value, onChange, min, max }: DateRangeFieldProps) {
  const labelId = useId();
  const selected = fromIsoDay(value);

  // react-day-picker rejects an open-ended {before, after}, so each bound is its own
  // matcher and an absent bound contributes none.
  const bounds = [
    fromIsoDay(min) ? { before: fromIsoDay(min)! } : undefined,
    fromIsoDay(max) ? { after: fromIsoDay(max)! } : undefined,
  ].filter((bound): bound is { before: Date } | { after: Date } => Boolean(bound));

  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase"
        id={labelId}
      >
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal tabular-nums sm:w-[11rem]"
            // An aria-label rather than aria-labelledby: pointing at the visible "From"
            // would *replace* the button's text, so a screen reader would announce the
            // field's name and lose the date currently chosen.
            aria-label={`${label}: ${selected ? LABEL_FORMAT.format(selected) : 'any date'}`}
          >
            <CalendarIcon strokeWidth={1.5} />
            {selected ? LABEL_FORMAT.format(selected) : <span className="text-muted-foreground">Any</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected}
            disabled={bounds}
            onSelect={(date) => onChange(date ? toIsoDay(date) : undefined)}
          />
          {value ? (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => onChange(undefined)}
              >
                Clear {label.toLowerCase()}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

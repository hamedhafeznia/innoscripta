import { SlidersHorizontal } from 'lucide-react';
import type { Filters } from '../../core/filters';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FilterBar } from './FilterBar';

type FilterPanelProps = React.ComponentProps<typeof FilterBar> & { activeCount: number };

/**
 * The filters inline on a wide screen, behind a sheet on a narrow one.
 *
 * Both render the same `FilterBar`, so there is one set of controls and no risk of the
 * two drifting apart. The sheet's copy is only mounted while the sheet is open, so the
 * form controls are never duplicated in the accessibility tree.
 */
export function FilterPanel({ activeCount, ...filterBarProps }: FilterPanelProps) {
  return (
    <>
      <div className="hidden w-full md:block">
        <FilterBar {...filterBarProps} />
      </div>

      <div className="w-full md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="h-11 w-full justify-start">
              <SlidersHorizontal />
              Filters
              {activeCount > 0 ? (
                <span className="ml-auto tabular-nums text-muted-foreground">{activeCount}</span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-xl">
            <SheetHeader className="pb-2">
              <SheetTitle className="font-serif text-lg font-medium">Filters</SheetTitle>
              {/* Vertical space is the scarcest thing in a bottom sheet; the controls say
                  the rest. Kept for the accessible description, not shown twice. */}
              <SheetDescription className="sr-only">
                Keyword, dates, categories and providers. Changes apply as you make them.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <FilterBar {...filterBarProps} bare />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

/** How many filters are actually narrowing the query, for the mobile trigger's badge. */
export function countActiveFilters(filters: Filters): number {
  return (
    (filters.query ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    filters.categories.length +
    filters.sources.length
  );
}

import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Input } from '@/components/ui/input';
import { DatePickerField } from '@/components/ui/date-picker';
import { PercentRangeFilter } from '@/components/ui/percent-range-filter';
import { cn } from '@/lib/utils';
import { ListFilter, Search, X } from 'lucide-react';

export type PostRangeFilterProps = {
  startDate: string;
  endDate: string;
  minHate: string;
  maxHate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMinHateChange: (value: string) => void;
  onMaxHateChange: (value: string) => void;
  filterHint?: string;
  /** Match search / prediction row height (40px). */
  size?: 'default' | 'comfortable';
  /** Show the inline “Clear” control beside the trigger. */
  showClearButton?: boolean;
  className?: string;
};

export function PostRangeFilterMenu({
  startDate,
  endDate,
  minHate,
  maxHate,
  onStartDateChange,
  onEndDateChange,
  onMinHateChange,
  onMaxHateChange,
  filterHint = 'Narrow the posts shown below',
  size = 'default',
  showClearButton = true,
  className,
}: PostRangeFilterProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = [startDate, endDate, minHate, maxHate].filter(Boolean).length;
  const hasRangeFilters = activeFilterCount > 0;

  const clearRangeFilters = () => {
    onStartDateChange('');
    onEndDateChange('');
    onMinHateChange('');
    onMaxHateChange('');
  };

  const controlHeight = size === 'comfortable' ? 'h-10 text-sm' : 'h-9 text-xs';

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <Popover.Root open={filterOpen} onOpenChange={setFilterOpen}>
        <Popover.Trigger
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 font-medium transition-colors',
            controlHeight,
            hasRangeFilters
              ? 'border-[var(--hg-brand)] bg-[var(--hg-soft)] text-[var(--hg-ink)]'
              : 'border-[var(--hg-border)] bg-white text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
            'data-popup-open:border-[var(--hg-brand)] data-popup-open:bg-[var(--hg-soft)] data-popup-open:text-[var(--hg-ink)]',
          )}
        >
          <ListFilter className="size-3.5" />
          Filter
          {hasRangeFilters && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-[3px] bg-[var(--hg-brand)] px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Popover.Popup
              className={cn(
                'w-[320px] origin-(--transform-origin) rounded-[4px] border border-[var(--hg-border)] bg-white p-5 shadow-[var(--hg-shadow)] outline-none',
                'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
                'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
              )}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--hg-ink)]">Filters</p>
                  <p className="mt-0.5 text-xs text-[var(--hg-muted)]">{filterHint}</p>
                </div>
                {hasRangeFilters && (
                  <button
                    type="button"
                    onClick={clearRangeFilters}
                    className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs font-medium text-[var(--hg-muted)] transition-colors hover:bg-[var(--hg-canvas)] hover:text-[var(--hg-ink)]"
                  >
                    <X className="size-3" />
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <section className="space-y-3">
                  <p className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
                    Date range
                  </p>
                  <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-3">
                    <DatePickerField
                      label="From"
                      value={startDate}
                      max={endDate || undefined}
                      rangeMate={endDate}
                      rangeRole="start"
                      clearable
                      onChange={onStartDateChange}
                      className="w-full justify-between gap-3 [&_button]:min-w-0 [&_button]:flex-1"
                    />
                    <DatePickerField
                      label="To"
                      value={endDate}
                      min={startDate || undefined}
                      rangeMate={startDate}
                      rangeRole="end"
                      clearable
                      onChange={onEndDateChange}
                      className="w-full justify-between gap-3 [&_button]:min-w-0 [&_button]:flex-1"
                    />
                  </div>
                </section>

                <section>
                  <PercentRangeFilter
                    label="Hate probability"
                    minValue={minHate}
                    maxValue={maxHate}
                    onMinChange={onMinHateChange}
                    onMaxChange={onMaxHateChange}
                  />
                </section>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {showClearButton && hasRangeFilters && (
        <button
          type="button"
          onClick={clearRangeFilters}
          className={cn(
            'inline-flex items-center gap-1 rounded-[4px] px-2 font-medium text-[var(--hg-muted)] transition-colors hover:text-[var(--hg-ink)]',
            controlHeight,
          )}
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}

export type PostQueryToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  startDate: string;
  endDate: string;
  minHate: string;
  maxHate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMinHateChange: (value: string) => void;
  onMaxHateChange: (value: string) => void;
  /** Popover helper line under “Filters”. */
  filterHint?: string;
  className?: string;
  /** Search input spans full toolbar width (side panels). */
  searchFullWidth?: boolean;
  /** Hide date/hate popover (e.g. render `PostRangeFilterMenu` elsewhere). */
  hideRangeFilter?: boolean;
};

export function PostQueryToolbar({
  search,
  onSearchChange,
  startDate,
  endDate,
  minHate,
  maxHate,
  onStartDateChange,
  onEndDateChange,
  onMinHateChange,
  onMaxHateChange,
  filterHint = 'Narrow the posts shown below',
  className,
  searchFullWidth = false,
  hideRangeFilter = false,
}: PostQueryToolbarProps) {
  const rangeProps: PostRangeFilterProps = {
    startDate,
    endDate,
    minHate,
    maxHate,
    onStartDateChange,
    onEndDateChange,
    onMinHateChange,
    onMaxHateChange,
    filterHint,
    size: searchFullWidth ? 'comfortable' : 'default',
  };

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative min-w-0 w-full',
          !searchFullWidth && 'sm:w-56 sm:max-w-sm',
          searchFullWidth && hideRangeFilter && 'w-full',
        )}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hg-subtle)]" />
        <Input
          placeholder="Search posts or IDs…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            'rounded-[4px] border-[var(--hg-border)] bg-[var(--hg-canvas)] pl-9 text-sm shadow-none focus-visible:border-[var(--hg-brand)] focus-visible:bg-white',
            searchFullWidth ? 'h-10' : 'h-9',
          )}
          aria-label="Search posts"
        />
      </div>

      {!hideRangeFilter && <PostRangeFilterMenu {...rangeProps} />}
    </div>
  );
}

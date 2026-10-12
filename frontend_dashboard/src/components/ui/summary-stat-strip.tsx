import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const SummaryStatBleedPaddingContext = createContext(true);

function useSummaryStatBleedPadding() {
  return useContext(SummaryStatBleedPaddingContext);
}

export type SummaryStatColumns = 2 | 3 | 4;

const GRID_CLASS: Record<SummaryStatColumns, string> = {
  2: 'grid grid-cols-1 divide-y divide-[var(--hg-border)] sm:grid-cols-2 sm:divide-y-0',
  3: 'grid grid-cols-1 divide-y divide-[var(--hg-border)] sm:grid-cols-3 sm:divide-y-0',
  4:
    'grid grid-cols-1 divide-y divide-[var(--hg-border)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4',
};

export function summaryStatSeparatorClassName(
  index: number,
  columns: SummaryStatColumns,
  accent?: boolean,
): string | null {
  if (index === 0 || accent) return null;
  const base = 'pointer-events-none absolute top-4 bottom-4 left-0 w-px bg-[var(--hg-border)]';
  if (columns === 4) {
    return cn(base, 'hidden', (index === 1 || index === 3) && 'sm:block', 'lg:block');
  }
  return cn(base, 'hidden sm:block');
}

/** Vertical rules for a 2-column mobile / 4-column desktop multi-row grid. */
export function summaryStatDenseSeparatorClassName(
  index: number,
  accent?: boolean,
): string | null {
  if (accent) return null;
  const base = 'pointer-events-none absolute top-4 bottom-4 left-0 w-px bg-[var(--hg-border)]';
  if (index % 4 !== 0) {
    return cn(base, 'hidden md:block');
  }
  if (index % 2 !== 0) {
    return cn(base, 'md:hidden');
  }
  return null;
}

export function SummaryStatStrip({
  children,
  bleed = true,
  className,
}: {
  children: ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        bleed && 'ml-[calc(50%-50cqi)] w-[100cqi] max-w-[100cqi] bg-white',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SummaryStatGrid({
  columns,
  children,
  bleedPadding = true,
  dense = false,
  className,
}: {
  columns: SummaryStatColumns;
  children: ReactNode;
  /** Left padding for full-bleed strips; disable inside cards. */
  bleedPadding?: boolean;
  /** 2×N layout (e.g. eight overall metrics). */
  dense?: boolean;
  className?: string;
}) {
  if (dense) {
    return (
      <SummaryStatBleedPaddingContext.Provider value={bleedPadding}>
        <div
          className={cn(
            'grid grid-cols-2 divide-y divide-[var(--hg-border)] md:grid-cols-4 md:divide-y-0',
            className,
          )}
        >
          {children}
        </div>
      </SummaryStatBleedPaddingContext.Provider>
    );
  }

  return (
    <SummaryStatBleedPaddingContext.Provider value={bleedPadding}>
      <div
        className={cn(
          GRID_CLASS[columns],
          bleedPadding && 'pl-4 md:pl-6 lg:pl-8',
          className,
        )}
      >
        {children}
      </div>
    </SummaryStatBleedPaddingContext.Provider>
  );
}

export function SummaryStatCell({
  index,
  columns,
  accent,
  dense,
  children,
  className,
}: {
  index: number;
  columns: SummaryStatColumns;
  accent?: boolean;
  dense?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const separatorClass = dense
    ? summaryStatDenseSeparatorClassName(index, accent)
    : summaryStatSeparatorClassName(index, columns, accent);

  const bleedPadding = useSummaryStatBleedPadding();
  const flushAccentLeft = index === 0 && accent && bleedPadding;

  return (
    <div
      className={cn(
        'relative flex min-h-[112px] items-stretch justify-between gap-4 px-5 py-5 md:px-6',
        flushAccentLeft &&
        '-ml-4 pl-9 md:-ml-6 md:pl-12 lg:-ml-8 lg:pl-14',
        accent && 'bg-[var(--hg-accent-surface)] text-white md:pr-6 lg:pr-8',
        dense &&
        !accent &&
        'border-b border-[var(--hg-border)] md:border-b-0',
        dense && accent && 'border-b-0',
        dense && !accent && index >= 6 && 'border-b-0',
        dense && !accent && index >= 4 && 'md:border-b-0',
        className,
      )}
    >
      {separatorClass ? <span aria-hidden className={separatorClass} /> : null}
      {children}
    </div>
  );
}

export function SummaryStatTile({
  label,
  value,
  subtitle,
  accent,
  valueClassName,
  adornment,
  details,
  trailing,
}: {
  label: string;
  value: ReactNode;
  subtitle?: string;
  accent?: boolean;
  valueClassName?: string;
  adornment?: ReactNode;
  /** Extra metrics below the main value, laid out in a horizontal row. */
  details?: { label: string; value: ReactNode; }[];
  trailing?: ReactNode;
}) {
  const labelClass = cn(
    'min-w-0 text-[13px] font-medium',
    accent ? 'text-white/90' : 'text-[var(--hg-muted)]',
  );
  const detailClass = cn(
    'text-[13px] font-medium tabular-nums',
    accent ? 'text-white/90' : 'text-[var(--hg-muted)]',
  );

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className={labelClass}>{label}</p>
        <div className="space-y-2">
          <div className={adornment ? 'flex flex-wrap items-center gap-2' : undefined}>
            <p
              className={cn(
                'text-[1.75rem] leading-none font-bold tracking-tight tabular-nums',
                accent ? 'text-white' : 'text-[var(--hg-ink)]',
                valueClassName,
              )}
            >
              {value}
            </p>
            {adornment}
          </div>
          <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-0.5">
            {details?.map((row) => (
              <p key={row.label} className={detailClass}>
                {row.label}: {row.value}
              </p>
            ))}
          </div>
        </div>
        {subtitle ? (
          <p className={cn('text-xs', accent ? 'text-white/85' : 'text-[var(--hg-subtle)]')}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing}
    </>
  );
}

import type { ReactNode } from 'react'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type DataTableColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  actions,
  actionsHeader = 'Actions',
  empty,
  maxHeight = '420px',
  className,
  caption,
}: {
  columns: DataTableColumn<T>[]
  data: readonly T[]
  getRowId: (row: T) => string
  actions?: (row: T) => ReactNode
  actionsHeader?: string
  empty?: ReactNode
  maxHeight?: string
  className?: string
  /** Accessible name announced by screen readers */
  caption?: string
}) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] items-center justify-center rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)]/50 px-6 py-12',
          className,
        )}
        role="status"
      >
        {empty ?? (
          <p className="text-sm text-[var(--hg-muted)]">No results</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-auto rounded-[4px] border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]',
        className,
      )}
      style={{ maxHeight }}
    >
      <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader className="sticky top-0 z-10 bg-[var(--hg-canvas)] [&_tr]:border-b-0 [&_tr]:hover:bg-transparent">
          <TableRow className="border-0 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                scope="col"
                className={cn(
                  'h-10 border-b border-[var(--hg-border)] bg-[var(--hg-canvas)] px-4 text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase',
                  col.headerClassName,
                )}
              >
                {col.header}
              </TableHead>
            ))}
            {actions ? (
              <TableHead
                scope="col"
                className="sticky right-0 z-20 h-10 border-b border-[var(--hg-border)] bg-[var(--hg-canvas)] px-4 text-left text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase"
              >
                {actionsHeader}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:nth-child(even)]:bg-transparent">
          {data.map((row) => (
            <TableRow
              key={getRowId(row)}
              className="border-0 transition-colors hover:bg-[var(--hg-soft)]/35"
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    'border-b border-[var(--hg-border)] px-4 py-3.5 align-middle text-[var(--hg-ink)]',
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
              {actions ? (
                <TableCell className="sticky right-0 border-b border-[var(--hg-border)] bg-white px-3 py-3 align-middle shadow-[-6px_0_8px_-6px_rgba(15,28,51,0.06)] group-hover/row:bg-[color-mix(in_srgb,var(--hg-soft)_35%,white)]">
                  <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  )
}

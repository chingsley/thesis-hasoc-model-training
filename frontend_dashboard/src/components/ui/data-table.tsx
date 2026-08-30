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
}: {
  columns: DataTableColumn<T>[]
  data: readonly T[]
  getRowId: (row: T) => string
  actions?: (row: T) => ReactNode
  actionsHeader?: string
  empty?: ReactNode
  maxHeight?: string
  className?: string
}) {
  if (data.length === 0) {
    return empty ?? null
  }

  return (
    <div
      className={cn('overflow-auto rounded-[8px] border border-border/70 bg-card shadow-sm', className)}
      style={{ maxHeight }}
    >
      <table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id} className={col.headerClassName}>
                {col.header}
              </TableHead>
            ))}
            {actions ? (
              <TableHead>{actionsHeader}</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
              {actions ? (
                <TableCell>
                  <div className="flex items-center gap-0.5">{actions(row)}</div>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  )
}

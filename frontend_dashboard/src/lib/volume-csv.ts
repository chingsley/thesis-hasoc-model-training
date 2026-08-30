import type { VolumeDataPoint } from '@/lib/types'

function escapeCsv(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function volumeToCsv(rows: VolumeDataPoint[]): string {
  const header = ['timestamp_utc', 'normal', 'abuse', 'hate', 'total']
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.hour),
        row.normal_count,
        row.abuse_count,
        row.hate_count,
        row.total,
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function downloadVolumeCsv(rows: VolumeDataPoint[], filename: string): void {
  const blob = new Blob([volumeToCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function sumVolume(
  rows: VolumeDataPoint[] | undefined,
  field: 'total' | 'normal_count' | 'abuse_count' | 'hate_count' = 'total',
): number {
  if (!rows?.length) return 0
  return rows.reduce((sum, row) => sum + (row[field] ?? 0), 0)
}

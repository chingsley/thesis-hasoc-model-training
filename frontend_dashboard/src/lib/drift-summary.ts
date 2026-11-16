import type { DriftDataPoint, Label } from './types'

/**
 * Plain-language reading of the confidence-drift series: for each label, how the average
 * confidence changed between the first and the latest day shown (the same two points the
 * technical chart's "Δ window" figure uses).
 */

/** Changes smaller than this many percentage points count as steady. */
export const DRIFT_STEADY_POINTS = 3
/** Changes of at least this many percentage points count as large. */
export const DRIFT_LARGE_POINTS = 10

export type DriftDirection = 'up' | 'down' | 'none'
export type DriftSize = 'steady' | 'slight' | 'large'

export interface DriftRow {
  label: Label
  values: number[]
  first: number
  latest: number
  /** latest − first, in percentage points. */
  changePoints: number
  direction: DriftDirection
  size: DriftSize
  /** e.g. "Steady", "Slightly less sure", "Much more sure". */
  status: string
}

const SERIES: { label: Label; key: keyof Omit<DriftDataPoint, 'date'> }[] = [
  { label: 'Hate', key: 'hate_avg_confidence' },
  { label: 'Abuse', key: 'abuse_avg_confidence' },
  { label: 'Normal', key: 'normal_avg_confidence' },
]

export function driftRows(data: DriftDataPoint[]): DriftRow[] {
  if (data.length === 0) return []
  return SERIES.map(({ label, key }) => {
    const values = data.map((point) => point[key])
    const first = values[0]
    const latest = values[values.length - 1]
    const changePoints = (latest - first) * 100
    const magnitude = Math.abs(changePoints)
    const direction: DriftDirection = changePoints > 0 ? 'up' : changePoints < 0 ? 'down' : 'none'
    const size: DriftSize =
      magnitude < DRIFT_STEADY_POINTS ? 'steady' : magnitude < DRIFT_LARGE_POINTS ? 'slight' : 'large'
    const status =
      size === 'steady'
        ? 'Steady'
        : `${size === 'slight' ? 'Slightly' : 'Much'} ${direction === 'up' ? 'more' : 'less'} sure`
    return { label, values, first, latest, changePoints, direction, size, status }
  })
}

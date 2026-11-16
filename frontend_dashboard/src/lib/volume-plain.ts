import type { ResolvedVolumeRange, VolumeMode } from './volume-range'

/** The selected period as words that fit after "HateGuard checked N posts …". */
export function plainRangePhrase(mode: VolumeMode, range: ResolvedVolumeRange): string {
  switch (mode) {
    case '24h':
      return 'in the last 24 hours'
    case '7d':
      return 'in the last 7 days'
    case '1m':
      return 'in the last month'
    case '3m':
      return 'in the last 3 months'
    case 'all':
      return 'in all the time on record'
    default: {
      if (range.shortLabel.includes('→')) {
        const [from, to] = range.shortLabel.split(' → ')
        return `from ${from} to ${to}`
      }
      return `on ${range.shortLabel}`
    }
  }
}

/** Plain charts show one bar per hour for a single day and one bar per day for longer periods. */
export function plainVolumeUnit(range: ResolvedVolumeRange): 'hour' | 'day' {
  return range.hours <= 24 ? 'hour' : 'day'
}

/** Splits `slots` whole units between the counts in proportion (largest-remainder method). */
export function apportion(counts: number[], slots: number): number[] {
  const total = counts.reduce((sum, n) => sum + n, 0)
  if (total <= 0) return counts.map(() => 0)
  const exact = counts.map((n) => (n / total) * slots)
  const result = exact.map(Math.floor)
  let left = slots - result.reduce((sum, n) => sum + n, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of order) {
    if (left <= 0) break
    result[index] += 1
    left -= 1
  }
  return result
}

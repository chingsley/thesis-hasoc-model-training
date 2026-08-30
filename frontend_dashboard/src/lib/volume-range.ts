export type VolumePresetId = '24h' | '7d' | '1m' | '3m'
export type VolumeMode = VolumePresetId | 'custom'
export type ChartStyle = 'line' | 'stacked'

export type VolumeRangeOption = {
  id: VolumePresetId
  label: string
  hours: number
  title: string
  shortLabel: string
  aggregate: 'hour' | 'day'
}

export const VOLUME_RANGE_OPTIONS: VolumeRangeOption[] = [
  { id: '24h', label: '24h', hours: 24, title: 'Last 24 Hours', shortLabel: '24 Hours', aggregate: 'hour' },
  { id: '7d', label: '7d', hours: 168, title: 'Last 7 Days', shortLabel: '7 Days', aggregate: 'hour' },
  { id: '1m', label: '1m', hours: 720, title: 'Last 1 Month', shortLabel: '1 Month', aggregate: 'day' },
  { id: '3m', label: '3m', hours: 2160, title: 'Last 3 Months', shortLabel: '3 Months', aggregate: 'day' },
]

export const DEFAULT_VOLUME_PRESET: VolumePresetId = '24h'
export const MAX_CUSTOM_DAYS = 90

/** @deprecated use VolumePresetId */
export type VolumeRangeId = VolumePresetId

export function getVolumeRange(id: VolumePresetId): VolumeRangeOption {
  return VOLUME_RANGE_OPTIONS.find((o) => o.id === id) ?? VOLUME_RANGE_OPTIONS[0]
}

export type VolumeQuery = {
  hours?: number
  since?: string
  until?: string
}

export type ResolvedVolumeRange = {
  title: string
  shortLabel: string
  aggregate: 'hour' | 'day'
  hours: number
  query: VolumeQuery
  queryKey: (string | number)[]
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export function resolveVolumeRange(
  mode: VolumeMode,
  customFrom: string,
  customTo: string,
): ResolvedVolumeRange {
  if (mode !== 'custom') {
    const preset = getVolumeRange(mode)
    return {
      title: preset.title,
      shortLabel: preset.shortLabel,
      aggregate: preset.aggregate,
      hours: preset.hours,
      query: { hours: preset.hours },
      queryKey: ['preset', preset.id, preset.hours],
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  let from = customFrom || customTo || today
  let to = customTo || customFrom || today
  if (from > to) {
    ;[from, to] = [to, from]
  }

  let daySpan = daysBetween(from, to) + 1
  if (daySpan > MAX_CUSTOM_DAYS) {
    const start = new Date(`${to}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - (MAX_CUSTOM_DAYS - 1))
    from = start.toISOString().slice(0, 10)
    daySpan = MAX_CUSTOM_DAYS
  }

  const hours = daySpan * 24
  const sameDay = from === to
  return {
    title: sameDay ? from : `${from} → ${to}`,
    shortLabel: sameDay ? from : `${from} → ${to}`,
    aggregate: daySpan > 7 ? 'day' : 'hour',
    hours,
    query: { since: from, until: to, hours },
    queryKey: ['custom', from, to],
  }
}

export function defaultCustomRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 6)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

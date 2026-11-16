import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVolumeData } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useVolumeSelectionStore } from '@/lib/store/volume-selection'
import { resolveVolumeRange } from '@/lib/volume-range'

/**
 * Post volume for the active language and the selected period. It uses the same query key as
 * VolumePanel, so the plain and technical views share one request and one cache entry.
 */
export function useVolume() {
  const language = useDashboardStore((s) => s.language)
  const mode = useVolumeSelectionStore((s) => s.mode)
  const customFrom = useVolumeSelectionStore((s) => s.customFrom)
  const customTo = useVolumeSelectionStore((s) => s.customTo)

  const range = useMemo(
    () => resolveVolumeRange(mode, customFrom, customTo),
    [mode, customFrom, customTo],
  )

  const query = useQuery({
    queryKey: ['volume', language, ...range.queryKey],
    queryFn: () =>
      fetchVolumeData(language, {
        hours: range.query.hours,
        since: range.query.since,
        until: range.query.until,
        all: range.query.all,
      }),
  })

  return { language, mode, range, data: query.data, isLoading: query.isLoading }
}

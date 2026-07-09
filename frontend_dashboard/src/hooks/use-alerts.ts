import { useQuery } from '@tanstack/react-query'
import { fetchAlerts, fetchVolumeData } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useEffect, useRef } from 'react'

export function useAlerts() {
  const setAlerts = useDashboardStore((s) => s.setAlerts)
  const alerts = useDashboardStore((s) => s.alerts)
  const prevTotal = useRef(0)

  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (query.data) {
      setAlerts(query.data)
    }
  }, [query.data, setAlerts])

  const volumeQuery = useQuery({
    queryKey: ['volume'],
    queryFn: fetchVolumeData,
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (volumeQuery.data && volumeQuery.data.length > 0) {
      const latest = volumeQuery.data[volumeQuery.data.length - 1]
      if (latest.hate_count > 40) {
        const newAlert = {
          id: `spike_${Date.now()}`,
          type: 'volume_spike' as const,
          message: `Hate post volume spike: ${latest.hate_count} posts detected in the last hour`,
          severity: latest.hate_count > 60 ? ('high' as const) : ('medium' as const),
          timestamp: new Date().toISOString(),
          read: false,
        }
        setAlerts([newAlert, ...alerts])
      }
      prevTotal.current = latest.total
    }
  }, [volumeQuery.data])

  return query
}

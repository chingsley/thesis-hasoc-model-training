import { useQuery } from '@tanstack/react-query'
import { fetchAlerts } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useEffect } from 'react'

export function useAlerts() {
  const setAlerts = useDashboardStore((s) => s.setAlerts)

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

  return query
}

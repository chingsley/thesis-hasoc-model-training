import { useQuery } from '@tanstack/react-query'
import { fetchModelMetrics, fetchDriftData } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'

export function useModelMetrics() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['metrics', language],
    queryFn: () => fetchModelMetrics(language),
    staleTime: 60000,
  })
}

export function useDriftData() {
  return useQuery({
    queryKey: ['drift'],
    queryFn: fetchDriftData,
    staleTime: 60000,
  })
}

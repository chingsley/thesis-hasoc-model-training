import { useQuery } from '@tanstack/react-query'
import { fetchModelMetrics, fetchDriftData } from '@/lib/api/client'

export function useModelMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: fetchModelMetrics,
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

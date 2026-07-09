import { useQuery } from '@tanstack/react-query'
import { fetchModelMetrics, fetchDriftData, fetchVolumeData, fetchClusters, fetchToxicTerms } from '@/lib/api/client'
import { useDashboardStore } from '@/lib/store/dashboard'

export function useModelMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: fetchModelMetrics,
  })
}

export function useDriftData() {
  return useQuery({
    queryKey: ['drift'],
    queryFn: fetchDriftData,
  })
}

export function useVolumeData() {
  return useQuery({
    queryKey: ['volume'],
    queryFn: fetchVolumeData,
  })
}

export function useClusters() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['clusters', language],
    queryFn: () => fetchClusters(language),
  })
}

export function useToxicTerms() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['toxic-terms', language],
    queryFn: () => fetchToxicTerms(language),
  })
}

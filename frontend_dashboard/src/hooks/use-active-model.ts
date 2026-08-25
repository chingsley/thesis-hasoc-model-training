import { useQuery } from '@tanstack/react-query'
import { useDashboardStore } from '@/lib/store/dashboard'
import { checkHealth } from '@/lib/api/http'
import { USE_MOCK } from '@/lib/api/config'

export function useActiveModel() {
  const language = useDashboardStore((s) => s.language)

  const query = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    staleTime: 5 * 60 * 1000,
    enabled: !USE_MOCK,
  })

  const activeModelId = query.data?.models[language] ?? query.data?.models.joint ?? null

  return {
    language,
    activeModelId,
    models: query.data?.models ?? {},
    device: query.data?.device,
    isLoading: query.isLoading,
    isLive: !USE_MOCK && Boolean(activeModelId),
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardStore } from '@/lib/store/dashboard'
import {
  fetchPosts,
  fetchTriagePosts,
  fetchBorderlinePosts,
  flagPost,
  updateTriageStatus,
} from '@/lib/api/client'
import type { Label } from '@/lib/types'

export function usePosts() {
  const language = useDashboardStore((s) => s.language)
  const hateThreshold = useDashboardStore((s) => s.hateThreshold)
  return useQuery({
    queryKey: ['posts', language, hateThreshold],
    queryFn: () => fetchPosts(language),
    select: (posts) => posts.filter((p) => p.probabilities.hate >= hateThreshold),
  })
}

export function useTriagePosts(label?: Label | 'all') {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['triage', language, label],
    queryFn: () => fetchTriagePosts(language, label === 'all' ? undefined : label),
  })
}

export function useBorderlinePosts() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['borderline', language],
    queryFn: () => fetchBorderlinePosts(language),
  })
}

export function useFlagPost() {
  const queryClient = useQueryClient()
  const language = useDashboardStore((s) => s.language)
  return useMutation({
    mutationFn: (postId: string) => flagPost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', language] })
      queryClient.invalidateQueries({ queryKey: ['triage', language] })
    },
  })
}

export function useUpdateTriageStatus() {
  const queryClient = useQueryClient()
  const language = useDashboardStore((s) => s.language)
  return useMutation({
    mutationFn: ({ postId, status }: { postId: string; status: 'new' | 'reviewed' | 'reported' }) =>
      updateTriageStatus(postId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage', language] })
      queryClient.invalidateQueries({ queryKey: ['posts', language] })
    },
  })
}

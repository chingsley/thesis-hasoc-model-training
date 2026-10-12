import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardStore } from '@/lib/store/dashboard'
import {
  fetchPosts,
  fetchTriagePosts,
  fetchTriageStats,
  fetchTriagePostsPage,
  fetchBorderlinePosts,
  flagPost,
  relabelPost,
  updateTriageStatus,
  type TriagePostsQuery,
} from '@/lib/api/client'
import type { Label, Post, TriageStatus } from '@/lib/types'

function patchPostInLists(queryClient: ReturnType<typeof useQueryClient>, language: string, updatedPost: Post) {
  for (const queryKey of [['triage', language], ['posts', language], ['borderline', language]] as const) {
    queryClient.setQueryData<Post[]>(queryKey, (old) =>
      old?.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    )
  }
}

function invalidateTriage(queryClient: ReturnType<typeof useQueryClient>, language: string) {
  void queryClient.invalidateQueries({ queryKey: ['triage-stats', language] })
  void queryClient.invalidateQueries({ queryKey: ['triage-posts', language] })
}

export function usePosts() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['posts', language],
    queryFn: () => fetchPosts(language),
  })
}

export function useTriagePosts() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['triage', language],
    queryFn: () => fetchTriagePosts(language),
  })
}

export function useTriageStats() {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: ['triage-stats', language],
    queryFn: () => fetchTriageStats(language),
    staleTime: 60_000,
  })
}

export function useTriagePostsPage(query: Omit<TriagePostsQuery, 'language'>) {
  const language = useDashboardStore((s) => s.language)
  return useQuery({
    queryKey: [
      'triage-posts',
      language,
      query.bucket,
      query.limit,
      query.offset,
      query.label ?? '',
      query.q ?? '',
      query.since ?? '',
      query.until ?? '',
      query.hateMin ?? '',
      query.hateMax ?? '',
    ],
    queryFn: () => fetchTriagePostsPage({ ...query, language }),
    placeholderData: (prev) => prev,
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
    onSuccess: (updatedPost) => {
      patchPostInLists(queryClient, language, updatedPost)
      invalidateTriage(queryClient, language)
      queryClient.invalidateQueries({ queryKey: ['reported-posts', language] })
    },
  })
}

export function useUpdateTriageStatus() {
  const queryClient = useQueryClient()
  const language = useDashboardStore((s) => s.language)
  return useMutation({
    mutationFn: ({ postId, status }: { postId: string; status: TriageStatus }) =>
      updateTriageStatus(postId, status),
    onSuccess: (updatedPost) => {
      patchPostInLists(queryClient, language, updatedPost)
      invalidateTriage(queryClient, language)
      queryClient.invalidateQueries({ queryKey: ['reported-posts', language] })
    },
  })
}

export function useRelabelPost() {
  const queryClient = useQueryClient()
  const language = useDashboardStore((s) => s.language)
  return useMutation({
    mutationFn: ({
      postId,
      manualLabel,
      bucket,
    }: {
      postId: string
      manualLabel: Label
      bucket?: 'flagged'
    }) => relabelPost(postId, manualLabel, bucket),
    onSuccess: (updatedPost) => {
      patchPostInLists(queryClient, language, updatedPost)
      invalidateTriage(queryClient, language)
      queryClient.invalidateQueries({ queryKey: ['reported-posts', language] })
    },
  })
}

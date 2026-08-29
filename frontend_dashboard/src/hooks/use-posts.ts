import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardStore } from '@/lib/store/dashboard'
import { fetchPosts, fetchTriagePosts, flagPost, relabelPost, updateTriageStatus } from '@/lib/api/client'
import type { Label, Post, TriageStatus } from '@/lib/types'

function patchPostInLists(queryClient: ReturnType<typeof useQueryClient>, language: string, updatedPost: Post) {
  for (const queryKey of [['triage', language], ['posts', language]] as const) {
    queryClient.setQueryData<Post[]>(queryKey, (old) =>
      old?.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    )
  }
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

export function useFlagPost() {
  const queryClient = useQueryClient()
  const language = useDashboardStore((s) => s.language)
  return useMutation({
    mutationFn: (postId: string) => flagPost(postId),
    onSuccess: (updatedPost) => {
      patchPostInLists(queryClient, language, updatedPost)
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
      bucket?: 'cleared' | 'flagged'
    }) => relabelPost(postId, manualLabel, bucket),
    onSuccess: (updatedPost) => {
      patchPostInLists(queryClient, language, updatedPost)
    },
  })
}

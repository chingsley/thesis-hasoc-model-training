import { useQuery } from '@tanstack/react-query'
import { fetchPostExplanations } from '@/lib/api/client'
import type { Post } from '@/lib/types'

export function useExplanation(post: Post | null) {
  return useQuery({
    queryKey: ['explanation', post?.id],
    queryFn: () => fetchPostExplanations(post!),
    enabled: !!post,
  })
}

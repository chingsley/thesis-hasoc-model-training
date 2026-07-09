import { useQuery } from '@tanstack/react-query'
import { fetchPostExplanation } from '@/lib/api/client'
import type { Post } from '@/lib/types'

export function useExplanation(post: Post | null) {
  return useQuery({
    queryKey: ['explanation', post?.id],
    queryFn: () => fetchPostExplanation(post!),
    enabled: !!post,
  })
}

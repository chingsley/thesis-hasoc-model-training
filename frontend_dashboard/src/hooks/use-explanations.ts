import { useQueries } from '@tanstack/react-query'
import { fetchExplanationMethod } from '@/lib/api/client'
import type { Post, XaiMethod } from '@/lib/types'

export const XAI_METHODS: XaiMethod[] = [
  'lime',
  'shap',
  'attention_rollout',
  'integrated_gradients',
]

/**
 * One query per XAI method, fired in parallel. Each returns as soon as the
 * backend finishes that method (server caches per (language, methods, text)),
 * so the UI renders panels incrementally instead of waiting for the slowest.
 * Result order matches XAI_METHODS.
 */
export function useExplanationMethods(post: Post | null) {
  return useQueries({
    queries: XAI_METHODS.map((method) => ({
      queryKey: ['explanation', post?.id, method],
      queryFn: () => fetchExplanationMethod(post!, method),
      enabled: !!post,
      staleTime: Infinity, // explanations are immutable for a fixed model
    })),
  })
}

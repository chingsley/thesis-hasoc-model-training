import { useQueries } from '@tanstack/react-query'
import { fetchExplanationMethod } from '@/lib/api/client'
import { crossMethodAgreementMean } from '@/lib/explain-agreement'
import type { ExplainTarget, ExplanationPayload, XaiMethod } from '@/lib/types'

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
export function useExplanationMethods(post: ExplainTarget | null) {
  return useQueries({
    queries: XAI_METHODS.map((method) => ({
      queryKey: ['explanation', post?.id, method],
      queryFn: () => fetchExplanationMethod(post!, method),
      enabled: !!post,
      staleTime: Infinity, // explanations are immutable for a fixed model
    })),
  })
}

export interface PostExplanation {
  /** Results merged across the methods that have finished; null when no post is selected. */
  explanation: ExplanationPayload | null
  /** Methods whose requests are still in flight. */
  loadingMethods: XaiMethod[]
  /** True while any method is still in flight. */
  loading: boolean
}

/**
 * The four per-method results for one post, merged into a single payload as they arrive.
 * Cross-method agreement is computed here, because the backend never sees the methods together.
 */
export function usePostExplanation(post: ExplainTarget | null): PostExplanation {
  const methodQueries = useExplanationMethods(post)
  if (!post) return { explanation: null, loadingMethods: [], loading: false }

  const mergedMethods: ExplanationPayload['methods'] = {}
  const metrics: ExplanationPayload['metrics'] = {}
  methodQueries.forEach((query, i) => {
    const method = XAI_METHODS[i]
    if (query.data) {
      Object.assign(mergedMethods, query.data.methods)
      Object.assign(metrics, query.data.metrics)
    } else if (query.isError) {
      mergedMethods[method] = {
        method,
        error: query.error instanceof Error ? query.error.message : 'Explanation failed',
      }
    }
  })
  const agreement = crossMethodAgreementMean(mergedMethods)
  if (agreement !== undefined) metrics.cross_method_agreement_mean = agreement
  const loadingMethods = XAI_METHODS.filter((_, i) => methodQueries[i].isPending)

  return {
    explanation: {
      id: post.id,
      label: post.predicted_label,
      text: post.tweet,
      methods: mergedMethods,
      metrics,
    },
    loadingMethods,
    loading: loadingMethods.length > 0,
  }
}

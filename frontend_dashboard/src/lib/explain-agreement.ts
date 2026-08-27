import type { ExplanationPayload } from './types'

/**
 * Client-side cross-method agreement (mean pairwise Jaccard of each method's
 * top-5 attributed tokens), mirroring cross_method_agreement() in the backend's
 * explain_service.py. Needed because the Explainability page fetches each method
 * separately for incremental rendering, so the backend never sees them together.
 */

function normalizeToken(token: string): string {
  return token.replace(/Ġ/g, '').replace(/▁/g, '').trim().toLowerCase()
}

type MethodEntry = NonNullable<ExplanationPayload['methods'][keyof ExplanationPayload['methods']]>

function topTokens(entry: MethodEntry | undefined, k = 5): Set<string> | null {
  if (!entry || 'error' in entry) return null
  const raw = (entry as { scores?: unknown[] }).scores ?? []
  const pairs = raw.map((item) =>
    Array.isArray(item)
      ? { token: String(item[0]), score: Number(item[1]) }
      : (item as { token: string; score: number })
  )
  if (pairs.length === 0) return null
  const ranked = [...pairs].sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, k)
  const tokens = new Set(ranked.map((p) => normalizeToken(p.token)).filter(Boolean))
  return tokens.size > 0 ? tokens : null
}

export function crossMethodAgreementMean(
  methods: ExplanationPayload['methods']
): number | undefined {
  const sets = (Object.keys(methods) as (keyof ExplanationPayload['methods'])[])
    .map((name) => topTokens(methods[name]))
    .filter((s): s is Set<string> => s !== null)
  if (sets.length < 2) return undefined
  const scores: number[] = []
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const union = new Set([...sets[i], ...sets[j]])
      const intersection = [...sets[i]].filter((t) => sets[j].has(t))
      scores.push(union.size > 0 ? intersection.length / union.size : 0)
    }
  }
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

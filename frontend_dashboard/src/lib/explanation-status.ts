import type { ExplanationPayload } from './types'

/** Targets shared by the Explanation Confidence panel and the plain-language view. */
export const AGREEMENT_TARGET = 0.5
export const FIDELITY_TARGET = 0.4
export const STABILITY_TARGET = 0.7

export type ExplanationStatus = 'passing' | 'needs_review' | 'pending'

/**
 * "Passing" when the methods agree on the key words and removing those words changes the
 * model's answer; "Needs review" when either is below target; "pending" until both are known.
 */
export function explanationStatus(metrics: ExplanationPayload['metrics']): ExplanationStatus {
  const agreement = metrics.cross_method_agreement_mean
  const fidelity = metrics.lime_faithfulness_aopc_proxy
  if (agreement === undefined || fidelity === undefined) return 'pending'
  return agreement >= AGREEMENT_TARGET && fidelity >= FIDELITY_TARGET ? 'passing' : 'needs_review'
}

export const EXPLANATION_STATUS_LABEL: Record<Exclude<ExplanationStatus, 'pending'>, string> = {
  passing: 'Passing',
  needs_review: 'Needs review',
}

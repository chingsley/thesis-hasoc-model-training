import type { Label, ModelMetrics } from './types'
import { LABEL_ORDER } from './plain-language'

/** What happened to the test posts that truly carry one label. */
export interface OutcomeRow {
  actual: Label
  total: number
  correct: number
  /** One entry per predicted label, in LABEL_ORDER; counts add up to total. */
  segments: { predicted: Label; count: number; correct: boolean }[]
}

/** Rows of the confusion matrix (actual label → predicted labels), in Normal, Abuse, Hate order. */
export function outcomeRows(matrix: number[][]): OutcomeRow[] {
  return LABEL_ORDER.map((actual, i) => {
    const row = matrix[i] ?? []
    const segments = LABEL_ORDER.map((predicted, j) => ({
      predicted,
      count: row[j] ?? 0,
      correct: i === j,
    }))
    return {
      actual,
      total: segments.reduce((sum, segment) => sum + segment.count, 0),
      correct: row[i] ?? 0,
      segments,
    }
  })
}

/** The label HateGuard finds least often (lowest recall), or null when there are no scores. */
export function weakestLabel(metrics: ModelMetrics): { label: Label; recall: number } | null {
  let weakest: { label: Label; recall: number } | null = null
  for (const label of LABEL_ORDER) {
    const recall = metrics.per_class?.[label]?.recall
    if (recall === undefined || !Number.isFinite(recall)) continue
    if (!weakest || recall < weakest.recall) weakest = { label, recall }
  }
  return weakest
}

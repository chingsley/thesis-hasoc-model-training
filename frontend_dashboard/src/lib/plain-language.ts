import { LABEL_SERIES_COLOR } from './label-series'
import type { Label } from './types'

/**
 * Wording and small helpers for the plain-language (non-expert) views.
 * Label definitions follow the AfriHate annotation guidelines, the scheme the models were
 * trained on, so the dashboard and the study's definitions slide say the same thing.
 */

export const LABEL_ORDER: Label[] = ['Normal', 'Abuse', 'Hate']

export type ProbabilityKey = 'normal' | 'abuse' | 'hate'

export const PLAIN_LABELS: Record<
  Label,
  {
    /** Adjective form used in sentences and tiles. */
    name: string
    /** Lower-case form for the middle of a sentence. */
    lower: string
    definition: string
    color: string
    probabilityKey: ProbabilityKey
  }
> = {
  Normal: {
    name: 'Normal',
    lower: 'normal',
    definition: 'No hateful or abusive language.',
    color: LABEL_SERIES_COLOR.Normal,
    probabilityKey: 'normal',
  },
  Abuse: {
    name: 'Abusive',
    lower: 'abusive',
    definition: 'Rude, insulting or belittling language meant to offend or harm someone.',
    color: LABEL_SERIES_COLOR.Abuse,
    probabilityKey: 'abuse',
  },
  Hate: {
    name: 'Hateful',
    lower: 'hateful',
    definition:
      'Shows hatred towards a person or group because of their ethnicity, religion, gender or similar traits, or threatens violence.',
    color: 'var(--hg-matrix-error)',
    probabilityKey: 'hate',
  },
}

export function toLabel(value: string): Label {
  const v = value.trim().toLowerCase()
  if (v === 'hate') return 'Hate'
  if (v === 'abuse') return 'Abuse'
  return 'Normal'
}

/** A verbal reading of a 0–1 probability. Always show the number next to it. */
export function certaintyPhrase(probability: number): string {
  if (probability >= 0.9) return 'Very sure'
  if (probability >= 0.7) return 'Fairly sure'
  if (probability >= 0.5) return 'Somewhat unsure'
  return 'Unsure'
}

/**
 * A 0–1 rate as a whole number out of 100. It never rounds a non-zero rate down to 0 or an
 * imperfect rate up to 100, so "0 of 100" and "100 of 100" are only shown when exactly true.
 */
export function outOf100(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0
  if (rate >= 1) return 100
  return Math.min(99, Math.max(1, Math.round(rate * 100)))
}

/** Exact percentage with one decimal, e.g. 94.6%. */
export function exactPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm
}

/** "a", "a and b", "a, b and c". */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

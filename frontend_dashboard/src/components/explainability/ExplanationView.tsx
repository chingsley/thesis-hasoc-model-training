import { useViewMode } from '@/lib/store/view-mode'
import { ConfidenceMeter } from './ConfidenceMeter'
import { ExplanationComparison } from './ExplanationComparison'
import { PlainExplanation } from './PlainExplanation'
import type { ExplanationPayload, Label, XaiMethod } from '@/lib/types'

interface ExplanationViewProps {
  text: string
  label: Label
  probabilities?: { normal: number; abuse: number; hate: number }
  explanation: ExplanationPayload
  loadingMethods: XaiMethod[]
  loading: boolean
}

/**
 * The explanation of one post in the view the user chose: the plain-language summary, or the
 * technical Explanation Confidence panel with the four method panels.
 */
export function ExplanationView({
  text,
  label,
  probabilities,
  explanation,
  loadingMethods,
  loading,
}: ExplanationViewProps) {
  const viewMode = useViewMode()

  if (viewMode === 'plain') {
    return (
      <PlainExplanation
        text={text}
        label={label}
        probabilities={probabilities}
        explanation={explanation}
        loading={loading}
      />
    )
  }

  return (
    <div className="space-y-8">
      <ConfidenceMeter metrics={explanation.metrics} loading={loading} />
      <ExplanationComparison explanation={explanation} loadingMethods={loadingMethods} />
    </div>
  )
}

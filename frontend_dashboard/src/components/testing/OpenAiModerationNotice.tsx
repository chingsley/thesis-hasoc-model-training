import { useActiveModel } from '@/hooks/use-active-model'
import { cn } from '@/lib/utils'

export function OpenAiModerationNotice({ className }: { className?: string }) {
  const { useOpenAiModeration, openaiModerationModel } = useActiveModel()

  if (!useOpenAiModeration) return null

  return (
    <div
      role="status"
      className={cn(
        'rounded-[4px] border border-sky-500/35 bg-sky-500/8 px-4 py-3',
        className,
      )}
    >
      <p className="text-sm font-semibold text-[var(--hg-ink)]">
        OpenAI Moderation API active
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--hg-muted)]">
        Classify Posts uses OpenAI&apos;s moderation endpoint (
        <span className="font-mono text-[11px]">{openaiModerationModel ?? 'omni-moderation'}</span>
        ) instead of your trained Afro-XLMR models. Labels are mapped to Normal, Abuse, and Hate for
        comparison. Classify Posts does not run local SHAP in this mode (faster, apples-to-apples with
        OpenAI only).
      </p>
    </div>
  )
}

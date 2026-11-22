import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  AGREEMENT_TARGET,
  EXPLANATION_STATUS_LABEL,
  FIDELITY_TARGET,
  explanationStatus,
} from '@/lib/explanation-status'
import {
  CONSENSUS_METHODS,
  consensusKeyWords,
  highlightSegments,
} from '@/lib/explain-consensus'
import { Badge, labelBadgeVariant } from '@/components/ui/badge'
import { REVIEW_AND_REPORT_TITLE } from '@/lib/module-names'
import { LABEL_ORDER, PLAIN_LABELS, certaintyPhrase, plural } from '@/lib/plain-language'
import { TechnicalName } from '@/components/ui/technical-name'
import { cn } from '@/lib/utils'
import type { ExplanationPayload, Label } from '@/lib/types'

interface PlainExplanationProps {
  text: string
  label: Label
  probabilities?: { normal: number; abuse: number; hate: number }
  /** Merged results so far; null when explanations cannot be computed for this post. */
  explanation: ExplanationPayload | null
  /** True while any explanation method is still running. */
  loading: boolean
  /** Shown in place of the word and reliability blocks when explanations are not available. */
  unavailableReason?: string
  /**
   * Name of the Technical-view component that shows the decision on this page, if there is one
   * (Classify Posts has "Class probabilities"; the Explainability card has none).
   */
  decisionTechnicalName?: string
}

function BlockHeading({
  step,
  children,
  technical,
}: {
  step: number
  children: string
  /** Name of the Technical-view component that shows the same thing. */
  technical?: string
}) {
  return (
    <div>
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--hg-ink)]">
        <span
          aria-hidden
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--hg-soft)] text-[11px] font-semibold text-[var(--hg-ink)]"
        >
          {step}
        </span>
        {children}
        {technical ? <TechnicalName>{technical}</TechnicalName> : null}
      </h3>
    </div>
  )
}

function Decision({
  label,
  probabilities,
  technical,
}: Pick<PlainExplanationProps, 'label' | 'probabilities'> & { technical?: string }) {
  const info = PLAIN_LABELS[label]
  const top = probabilities?.[info.probabilityKey]
  const runnerUp = probabilities
    ? LABEL_ORDER.filter((other) => other !== label)
        .map((other) => ({ other, value: probabilities[PLAIN_LABELS[other].probabilityKey] }))
        .sort((a, b) => b.value - a.value)[0]
    : undefined

  return (
    <section className="space-y-3">
      <BlockHeading step={1} technical={technical}>
        What HateGuard decided
      </BlockHeading>
      <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4">
        <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Possible labels">
          {LABEL_ORDER.map((option) => {
            const chosen = option === label
            return (
              <Badge
                key={option}
                role="listitem"
                aria-current={chosen ? 'true' : undefined}
                variant={chosen ? labelBadgeVariant(option) : 'outline'}
                className={cn(
                  'h-auto rounded-[4px] px-2.5 py-0.5 text-sm font-semibold',
                  !chosen && 'text-[var(--hg-subtle)]',
                )}
              >
                {PLAIN_LABELS[option].name}
                {chosen ? <span className="sr-only"> (HateGuard's label)</span> : null}
              </Badge>
            )
          })}
        </div>
        <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
          HateGuard labelled this post <strong>{info.name}</strong>.{' '}
          <span className="text-[var(--hg-muted)]">{info.definition}</span>
        </p>
        {top !== undefined ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--hg-ink)]">
                {certaintyPhrase(top)}{' '}
                <span className="font-normal text-[var(--hg-muted)]">
                  about this label ({Math.round(top * 100)}% confidence)
                </span>
              </p>
              {runnerUp && runnerUp.value >= 0.1 ? (
                <p className="text-xs text-[var(--hg-muted)]">
                  It also considered {PLAIN_LABELS[runnerUp.other].name} (
                  {Math.round(runnerUp.value * 100)}%)
                </p>
              ) : null}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-[var(--hg-canvas)]"
              role="img"
              aria-label={`${Math.round(top * 100)}% confidence`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, top * 100))}%`,
                  backgroundColor: info.color,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function VoteDots({ votes, total }: { votes: number; total: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      role="img"
      aria-label={`Picked by ${votes} of ${total} explanation methods`}
      title={`Picked by ${votes} of ${total} explanation methods`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'size-2 rounded-full',
            i < votes ? 'bg-[var(--hg-ink)]' : 'border border-[var(--hg-subtle)]/50 bg-transparent',
          )}
        />
      ))}
    </span>
  )
}

function KeyWords({
  text,
  label,
  explanation,
  loading,
}: Pick<PlainExplanationProps, 'text' | 'label' | 'loading'> & { explanation: ExplanationPayload }) {
  const info = PLAIN_LABELS[label]

  if (loading) {
    const total = CONSENSUS_METHODS.length
    const done = CONSENSUS_METHODS.filter((method) => explanation.methods[method]).length
    return (
      <div
        className="flex items-center gap-2.5 rounded-[4px] border border-[var(--hg-border)] p-4 text-sm text-[var(--hg-muted)]"
        role="status"
      >
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        Working out which words mattered… ({done} of {total} explanation methods finished)
      </div>
    )
  }

  const consensus = consensusKeyWords(text, explanation.methods)
  if (consensus.methodsUsed === 0) {
    return (
      <p className="rounded-[4px] border border-dashed border-[var(--hg-border)] p-4 text-sm text-[var(--hg-muted)]">
        The explanation could not be worked out for this post. You can still see each method's
        message in the Technical view.
      </p>
    )
  }

  const { keyWords, weak, methodsUsed, votesByKey } = consensus
  const segments = highlightSegments(text, votesByKey)

  return (
    <div className="space-y-4 rounded-[4px] border border-[var(--hg-border)] p-4">
      <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
        {keyWords.length === 0 ? (
          <>No single word stood out as a reason for the {info.name} label.</>
        ) : weak ? (
          <>
            The explanation methods did not agree on which words mattered most. Each word below was
            picked by only one method, so treat it with caution.
          </>
        ) : (
          <>
            {keyWords.length === 1 ? 'This word' : 'These words'} pushed HateGuard most towards{' '}
            <strong>{info.name}</strong>. Darker highlighting means more explanation methods picked
            the word.
          </>
        )}
      </p>

      <p
        className="rounded-[4px] bg-[var(--hg-canvas)]/60 px-3 py-3 text-[15px] leading-[1.9] break-words whitespace-pre-wrap text-[var(--hg-ink)]"
        aria-label="The post, with the key words highlighted"
      >
        {segments.map((segment, i) =>
          segment.votes > 0 ? (
            <mark
              key={i}
              style={{
                backgroundColor: `color-mix(in srgb, ${info.color} ${Math.round(
                  14 + (segment.votes / methodsUsed) * 36,
                )}%, transparent)`,
              }}
              className="rounded-[4px] px-1 py-0.5 font-semibold text-[var(--hg-ink)]"
            >
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </p>

      {keyWords.length > 0 ? (
        <ul className="divide-y divide-[var(--hg-border)]" aria-label="Key words">
          {keyWords.map((word) => (
            <li key={word.key} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 text-sm font-semibold break-words text-[var(--hg-ink)]">
                {word.display}
              </span>
              <span className="flex shrink-0 items-center gap-2.5 text-xs text-[var(--hg-muted)]">
                {word.votes} of {methodsUsed} {plural(methodsUsed, 'method')}
                <VoteDots votes={word.votes} total={methodsUsed} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Reliability({
  explanation,
  loading,
}: {
  explanation: ExplanationPayload
  loading: boolean
}) {
  const status = explanationStatus(explanation.metrics)

  if (status === 'pending') {
    return (
      <p
        className="rounded-[4px] border border-[var(--hg-border)] p-4 text-sm text-[var(--hg-muted)]"
        role="status"
      >
        {loading
          ? 'Checking how reliable this explanation is…'
          : 'There is not enough information to rate this explanation.'}
      </p>
    )
  }

  const passing = status === 'passing'
  const agreement = explanation.metrics.cross_method_agreement_mean ?? 0
  const fidelity = explanation.metrics.lime_faithfulness_aopc_proxy ?? 0
  const concerns = [
    agreement < AGREEMENT_TARGET ? 'the explanation methods disagree about which words mattered' : null,
    fidelity < FIDELITY_TARGET
      ? "removing the highlighted words hardly changes HateGuard's answer"
      : null,
  ].filter((concern): concern is string => concern !== null)

  return (
    <div
      className={cn(
        'space-y-2 rounded-[4px] border p-4',
        'border-[var(--hg-border)] bg-[var(--hg-canvas)]',
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--hg-ink)]">
        {passing ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <AlertTriangle className="size-5 shrink-0 text-amber-500" aria-hidden />
        )}
        <span>Explanation Confidence:</span>
        <strong
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-semibold',
            passing ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {EXPLANATION_STATUS_LABEL[status]}
        </strong>
      </p>
      <p className="text-sm leading-relaxed text-[var(--hg-ink)]">
        {passing
          ? "The explanation methods largely agree on the key words, and HateGuard's answer changes when those words are removed. The highlighted words are likely to be the real reasons for this label."
          : `Treat this explanation with caution: ${concerns.join(' and ')}.`}
      </p>
    </div>
  )
}

/**
 * Plain-language explanation of one post: the decision, the words behind it (the four
 * explanation methods merged into one answer), and whether the explanation can be relied on.
 */
export function PlainExplanation({
  text,
  label,
  probabilities,
  explanation,
  loading,
  unavailableReason,
  decisionTechnicalName,
}: PlainExplanationProps) {
  return (
    <div className="space-y-6">
      <Decision label={label} probabilities={probabilities} technical={decisionTechnicalName} />

      {explanation ? (
        <>
          <section className="space-y-3">
            <BlockHeading
              step={2}
              technical="Method Comparison (LIME, SHAP, Attention Rollout, Integrated Gradients)"
            >
              The words behind this decision
            </BlockHeading>
            <KeyWords text={text} label={label} explanation={explanation} loading={loading} />
          </section>
          <section className="space-y-3">
            <BlockHeading step={3} technical="Explanation Confidence">
              Can you rely on this explanation?
            </BlockHeading>
            <Reliability explanation={explanation} loading={loading} />
          </section>
        </>
      ) : (
        <p className="rounded-[4px] border border-dashed border-[var(--hg-border)] p-4 text-sm text-[var(--hg-muted)]">
          {unavailableReason ?? 'No explanation is available for this post.'}
        </p>
      )}

      <p className="text-xs leading-relaxed text-[var(--hg-muted)]">
        HateGuard can be wrong. Meaning depends on context, sarcasm and who is speaking, so use
        your own judgement. You can correct a label in{' '}
        <Link to="/triage" className="font-medium text-[var(--hg-brand)] hover:underline">
          {REVIEW_AND_REPORT_TITLE}
        </Link>
        .
      </p>
    </div>
  )
}

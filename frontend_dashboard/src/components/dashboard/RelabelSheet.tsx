import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PredictionCell } from '@/components/dashboard/post-cells'
import type { Label, Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, CheckCircle, Flag, Loader2, X } from 'lucide-react'

const LABELS: Label[] = ['Normal', 'Abuse', 'Hate']

export type RelabelMode = 'create' | 'edit'

interface RelabelSheetProps {
  /** When set, the sheet is open. */
  post: Post | null
  /** create: from Pending (choose label + bucket) · edit: from Relabelled (label only) */
  mode: RelabelMode
  saving: boolean
  onSave: (label: Label, bucket?: 'cleared' | 'flagged') => void | Promise<void>
  onClose: () => void
}

const labelStyles: Record<
  Label,
  { idle: string; selected: string; check: string }
> = {
  Normal: {
    idle: 'border-emerald-200 bg-emerald-50/40 text-[var(--hg-ink)] hover:border-emerald-300 hover:bg-emerald-50',
    selected:
      'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20',
    check: 'bg-emerald-600 text-white',
  },
  Abuse: {
    idle: 'border-amber-200 bg-amber-50/40 text-[var(--hg-ink)] hover:border-amber-300 hover:bg-amber-50',
    selected: 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-500/20',
    check: 'bg-amber-600 text-white',
  },
  Hate: {
    idle: 'border-rose-200 bg-rose-50/40 text-[var(--hg-ink)] hover:border-rose-300 hover:bg-rose-50',
    selected: 'border-[var(--hg-secondary)] bg-rose-50 text-rose-950 ring-2 ring-[var(--hg-secondary)]/20',
    check: 'bg-[var(--hg-secondary)] text-white',
  },
}

function RelabelForm({
  post,
  mode,
  saving,
  onSave,
  onCancel,
}: {
  post: Post
  mode: RelabelMode
  saving: boolean
  onSave: (label: Label, bucket?: 'cleared' | 'flagged') => void | Promise<void>
  onCancel: () => void
}) {
  const [label, setLabel] = useState<Label>(post.manual_label ?? post.predicted_label)
  const [bucket, setBucket] = useState<'cleared' | 'flagged'>(
    post.triage_status === 'flagged' ? 'flagged' : 'cleared',
  )

  const handleSave = async () => {
    try {
      await Promise.resolve(onSave(label, mode === 'create' ? bucket : undefined))
      onCancel()
    } catch {
      // Keep the sheet open when the save request fails.
    }
  }

  return (
    <>
      <div className="flex-1 space-y-6 overflow-auto px-6 py-5">
        <div className="rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-4">
          <p className="text-sm leading-relaxed text-[var(--hg-ink)]">{post.tweet}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-[4px] border border-[var(--hg-border)] bg-white px-1.5 py-0.5 font-mono text-[11px] text-[var(--hg-muted)]">
              {post.id}
            </span>
            <span className="text-[11px] text-[var(--hg-muted)]">Model label</span>
            <PredictionCell label={post.predicted_label} />
          </div>
        </div>

        <fieldset className="space-y-2.5 border-0 p-0">
          <legend className="text-sm font-semibold text-[var(--hg-ink)]">Correct label</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Correct label">
            {LABELS.map((l) => {
              const selected = label === l
              const styles = labelStyles[l]
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setLabel(l)}
                  className={cn(
                    'relative flex items-center justify-center gap-1.5 rounded-[4px] border px-3 py-3 text-sm font-semibold transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30',
                    selected ? styles.selected : styles.idle,
                  )}
                >
                  {selected && (
                    <span
                      className={cn(
                        'inline-flex size-4 shrink-0 items-center justify-center rounded-full',
                        styles.check,
                      )}
                      aria-hidden
                    >
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  )}
                  {l}
                </button>
              )
            })}
          </div>
        </fieldset>

        {mode === 'create' && (
          <fieldset className="space-y-2.5 border-0 p-0">
            <legend className="text-sm font-semibold text-[var(--hg-ink)]">Send to bucket</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Send to bucket">
              {(
                [
                  { id: 'flagged' as const, label: 'Flagged', icon: Flag },
                  { id: 'cleared' as const, label: 'Cleared', icon: CheckCircle },
                ] as const
              ).map((option) => {
                const selected = bucket === option.id
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBucket(option.id)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-[4px] border px-3 py-3 text-sm font-medium transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30',
                      selected
                        ? 'border-[var(--hg-brand)] bg-[var(--hg-soft)] text-[var(--hg-ink)] shadow-sm'
                        : 'border-[var(--hg-border)] bg-white text-[var(--hg-muted)] hover:border-[var(--hg-muted)] hover:bg-[var(--hg-canvas)] hover:text-[var(--hg-ink)]',
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {option.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--hg-border)] bg-white px-6 py-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-[4px] border-[var(--hg-border)] px-4 text-[var(--hg-ink)] hover:bg-[var(--hg-canvas)]"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-9 rounded-[4px] bg-[var(--hg-ink)] px-4 text-white hover:bg-[var(--hg-ink)]/90"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </>
  )
}

/**
 * Right slide-over for relabelling a post. Slides in when `post` is set and
 * slides back out on Cancel/Save/close before unmounting (state-driven, so the
 * animation always plays in both directions). The form remounts per post via
 * `key`, so its state always initializes from the current post.
 */
export function RelabelSheet({ post, mode, saving, onSave, onClose }: RelabelSheetProps) {
  const [visible, setVisible] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!post) return
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [post])

  useEffect(() => {
    if (!post) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault()
        setVisible(false)
        window.setTimeout(onClose, 300)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [post, saving, onClose])

  if (!post) return null

  const close = () => {
    if (saving) return
    setVisible(false)
    window.setTimeout(onClose, 300)
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        className={cn(
          'absolute inset-0 bg-[var(--hg-ink)]/25 backdrop-blur-[1px] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={close}
        aria-hidden
      />
      <div
        className={cn(
          'absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--hg-border)] px-6 py-5">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-[var(--hg-ink)]">
              {mode === 'create' ? 'Relabel post' : 'Edit manual label'}
            </h2>
            <p id={descriptionId} className="text-sm leading-snug text-[var(--hg-muted)]">
              {mode === 'create'
                ? 'Correct the model’s label and choose where the post goes.'
                : 'Update the manual label. Matching the model’s label removes the post from Relabelled.'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[4px] text-[var(--hg-muted)] transition-colors hover:bg-[var(--hg-canvas)] hover:text-[var(--hg-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hg-brand)]/30 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <RelabelForm
          key={`${post.id}:${mode}`}
          post={post}
          mode={mode}
          saving={saving}
          onSave={onSave}
          onCancel={close}
        />
      </div>
    </div>
  )
}

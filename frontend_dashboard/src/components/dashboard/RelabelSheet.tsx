import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Label, Post } from '@/lib/types'
import { Flag, CheckCircle, X, Loader2 } from 'lucide-react'

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

const labelStyles: Record<Label, string> = {
  Normal: 'border-green-500/50 data-[selected]:bg-green-500/10',
  Abuse: 'border-amber-500/50 data-[selected]:bg-amber-500/10',
  Hate: 'border-destructive/50 data-[selected]:bg-destructive/10',
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
    post.triage_status === 'flagged' ? 'flagged' : 'cleared'
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
      <div className="flex-1 overflow-auto p-5 space-y-5">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm">{post.tweet}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">{post.id}</Badge>
            <span className="text-xs text-muted-foreground">
              Model label: <strong>{post.predicted_label}</strong>
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Correct label</p>
          <div className="grid grid-cols-3 gap-2">
            {LABELS.map((l) => (
              <button
                key={l}
                type="button"
                data-selected={label === l || undefined}
                onClick={() => setLabel(l)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent ${labelStyles[l]}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {mode === 'create' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Send to bucket</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-selected={bucket === 'flagged' || undefined}
                onClick={() => setBucket('flagged')}
                className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent data-[selected]:border-primary data-[selected]:bg-primary/5"
              >
                <Flag className="h-3.5 w-3.5" /> Flagged
              </button>
              <button
                type="button"
                data-selected={bucket === 'cleared' || undefined}
                onClick={() => setBucket('cleared')}
                className="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent data-[selected]:border-primary data-[selected]:bg-primary/5"
              >
                <CheckCircle className="h-3.5 w-3.5" /> Cleared
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 p-5 border-t border-border">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
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

  useEffect(() => {
    if (!post) return
    // next frame so the enter transition plays from translate-x-full
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [post])

  if (!post) return null

  const close = () => {
    setVisible(false)
    window.setTimeout(onClose, 300)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Relabel post">
      <div
        className={`absolute inset-0 bg-black/20 transition-opacity duration-300 cursor-pointer ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl
          transition-transform duration-300 ease-in-out flex flex-col
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'Relabel post' : 'Edit manual label'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {mode === 'create'
                ? 'Correct the model’s label and choose where the post goes.'
                : 'Update the manual label. Matching the model’s label removes the post from the Relabelled bucket.'}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
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

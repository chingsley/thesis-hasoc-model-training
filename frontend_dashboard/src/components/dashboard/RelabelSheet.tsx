import { useEffect, useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { HateProbCell, PredictionCell } from '@/components/dashboard/post-cells';
import type { Label, Post } from '@/lib/types';
import { modelPrediction, reviewerLabel } from '@/lib/post-labels';
import { cn } from '@/lib/utils';
import { Check, Flag, Loader2, X } from 'lucide-react';

function formatLanguage(language: Post['language']) {
  return language === 'igbo' ? 'Igbo' : 'Yoruba';
}

function formatProb(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDateTime(timestamp?: string | null) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return timestamp;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 text-sm', className)}>
      <dt className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-[var(--hg-ink)]">{children}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-wide text-[var(--hg-muted)] uppercase">
      {children}
    </h3>
  );
}

function PostDetailsMeta({ post }: { post: Post }) {
  return (
    <dl className="space-y-2.5 rounded-[4px] border border-[var(--hg-border)] bg-white p-4">
      <DetailRow label="Post ID">
        <span className="font-mono text-[11px] break-all">{post.id}</span>
      </DetailRow>
      <DetailRow label="Language">{formatLanguage(post.language)}</DetailRow>
      <DetailRow label="Source">{post.split}</DetailRow>
      <DetailRow label="Length">{post.length.toLocaleString()} chars</DetailRow>
      <DetailRow label="Prediction">
        <PredictionCell label={modelPrediction(post)} />
      </DetailRow>
      <DetailRow label="Reviewer label">
        {reviewerLabel(post) ? (
          <PredictionCell label={reviewerLabel(post)!} />
        ) : (
          <span className="text-[var(--hg-muted)]">—</span>
        )}
      </DetailRow>
      <DetailRow label="Relabelled">{post.relabelled ? 'Yes' : 'No'}</DetailRow>
      <DetailRow label="Review status">
        {post.triage_status === 'flagged' ? 'Flagged' : 'Pending'}
      </DetailRow>
      <DetailRow label="Flagged">{post.flagged ? 'Yes' : 'No'}</DetailRow>
      <DetailRow label="Hate %">
        <HateProbCell value={post.probabilities.hate} />
      </DetailRow>
      <DetailRow label="Probabilities">
        <span className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
          N {formatProb(post.probabilities.normal)} · A {formatProb(post.probabilities.abuse)} · H{' '}
          {formatProb(post.probabilities.hate)}
        </span>
      </DetailRow>
      <DetailRow label="Reviewer">
        {post.reviewer_id != null ? (
          <span className="font-mono text-[11px]">user #{post.reviewer_id}</span>
        ) : (
          <span className="text-[var(--hg-muted)]">—</span>
        )}
      </DetailRow>
      <DetailRow label="Reviewed at">{formatDateTime(post.reviewed_at)}</DetailRow>
      <DetailRow label="Processed">{formatDateTime(post.timestamp)}</DetailRow>
    </dl>
  );
}

const LABELS: Label[] = ['Normal', 'Abuse', 'Hate'];

export type RelabelMode = 'create' | 'edit';

interface RelabelSheetProps {
  /** When set, the sheet is open. */
  post: Post | null;
  /** create: relabel from queue · edit: from Relabelled */
  mode: RelabelMode;
  saving: boolean;
  onSave: (label: Label, bucket?: 'flagged') => void | Promise<void>;
  onClose: () => void;
}

const labelStyles: Record<
  Label,
  { idle: string; selected: string; check: string; }
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
};

function RelabelForm({
  post,
  mode,
  saving,
  onSave,
  onCancel,
}: {
  post: Post;
  mode: RelabelMode;
  saving: boolean;
  onSave: (label: Label, bucket?: 'flagged') => void | Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState<Label>(
    reviewerLabel(post) ?? modelPrediction(post),
  );
  const [alsoFlag, setAlsoFlag] = useState(false);

  const handleSave = async () => {
    try {
      await Promise.resolve(
        onSave(label, mode === 'create' && alsoFlag ? 'flagged' : undefined),
      );
      onCancel();
    } catch {
      // Keep the sheet open when the save request fails.
    }
  };

  return (
    <>
      <div className="flex-1 overflow-auto">
        <section className="space-y-2 border-b border-[var(--hg-border)] px-6 py-5">
          <SectionHeading>Post text</SectionHeading>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--hg-ink)]">
            {post.tweet}
          </p>
        </section>

        <section className="space-y-3 border-b border-[var(--hg-border)] px-6 py-5">
          <SectionHeading>Post details</SectionHeading>
          <PostDetailsMeta post={post} />
        </section>

        <section className="space-y-3 border-b border-[var(--hg-border)] px-6 py-5">
          <SectionHeading>Correct label</SectionHeading>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Correct label">
            {LABELS.map((l) => {
              const selected = label === l;
              const styles = labelStyles[l];
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
              );
            })}
          </div>
        </section>

        {mode === 'create' && (
          <section className="border-b border-[var(--hg-border)] px-6 py-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={alsoFlag}
                onChange={(e) => setAlsoFlag(e.target.checked)}
                className="mt-0.5 size-4 rounded border-[var(--hg-border)]"
              />
              <span className="min-w-0 space-y-0.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--hg-ink)]">
                  <Flag className="size-3.5 text-[var(--hg-muted)]" aria-hidden />
                  Also flag for incident report
                </span>
                <span className="block text-xs text-[var(--hg-muted)]">
                  The post stays in the queue and appears in the Flagged tab.
                </span>
              </span>
            </label>
          </section>
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
          className="h-9 rounded-[4px] bg-[var(--hg-accent-surface)] px-4 text-white hover:bg-[var(--hg-accent-surface-hover)]"
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
  );
}

/**
 * Right slide-over for relabelling a post. Slides in when `post` is set and
 * slides back out on Cancel/Save/close before unmounting (state-driven, so the
 * animation always plays in both directions). The form remounts per post via
 * `key`, so its state always initializes from the current post.
 */
export function RelabelSheet({ post, mode, saving, onSave, onClose }: RelabelSheetProps) {
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!post) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [post]);

  useEffect(() => {
    if (!post) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        setVisible(false);
        window.setTimeout(onClose, 300);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [post, saving, onClose]);

  if (!post) return null;

  const close = () => {
    if (saving) return;
    setVisible(false);
    window.setTimeout(onClose, 300);
  };

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
              {mode === 'create' ? 'Relabel post' : 'Edit relabel'}
            </h2>
            <p id={descriptionId} className="text-sm leading-snug text-[var(--hg-muted)]">
              {mode === 'create'
                ? 'Correct the model’s label. Optionally flag for an incident report — the post stays in the queue.'
                : 'Change the reviewer label. Setting it back to the model prediction removes the post from Relabelled.'}
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
  );
}

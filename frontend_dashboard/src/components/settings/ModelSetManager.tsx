import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchModelSetStatus, switchModelSet } from '@/lib/api/client';
import { ApiError } from '@/lib/api/http';
import type { ModelSetName, ModelSetOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  settingsFormActionClass,
  settingsSectionHeaderClass,
} from '@/components/settings/settings-form-layout';

const MODEL_SET_COPY: Record<ModelSetName, { title: string; description: string }> = {
  original: { title: 'Original', description: 'Models trained on the original dataset.' },
  merged: { title: 'Merged', description: 'Models retrained on the merged dataset.' },
};

const ROUTE_LABELS: Record<string, string> = {
  igbo: 'Igbo',
  yoruba: 'Yoruba',
  joint: 'Joint (fallback)',
};

const POLL_MS = 3000;

function parseApiError(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as { detail?: string; };
      if (typeof parsed.detail === 'string') return parsed.detail;
    } catch {
      /* plain text */
    }
    return err.message || 'Request failed';
  }
  return 'Something went wrong';
}

function envVarHint(id: ModelSetName): string {
  const suffix = id === 'merged' ? '_MERGED' : '';
  return `Set HF_MODEL_ID_IGBO${suffix} and HF_MODEL_ID_YORUBA${suffix} in the API's .env, then restart the API.`;
}

export function ModelSetManager() {
  const queryClient = useQueryClient();
  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ['model-set'],
    queryFn: fetchModelSetStatus,
    refetchInterval: (query) => (query.state.data?.loading ? POLL_MS : false),
  });
  const [confirmTarget, setConfirmTarget] = useState<ModelSetName | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadingRef = useRef<ModelSetName | null>(null);

  // A background load just finished: refetch everything model-dependent
  // (header badge, metrics, posts, explanations) if it succeeded.
  useEffect(() => {
    if (!status) return;
    const previous = loadingRef.current;
    loadingRef.current = status.loading;
    if (previous && !status.loading && status.active === previous) {
      setNotice(`Now serving the ${MODEL_SET_COPY[previous].title.toLowerCase()} models.`);
      void queryClient.invalidateQueries();
    }
  }, [status, queryClient]);

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setBusy(true);
    setRequestError(null);
    setNotice(null);
    try {
      const next = await switchModelSet(target);
      queryClient.setQueryData(['model-set'], next);
      if (!next.loading && next.active === target) {
        setNotice(`Now serving the ${MODEL_SET_COPY[target].title.toLowerCase()} models.`);
        await queryClient.invalidateQueries();
      }
    } catch (err) {
      setRequestError(parseApiError(err));
    } finally {
      setBusy(false);
      setConfirmTarget(null);
    }
  };

  const renderOption = (option: ModelSetOption) => {
    const copy = MODEL_SET_COPY[option.id];
    const active = status?.active === option.id;
    const loading = status?.loading === option.id;
    const disabled = active || !option.configured || Boolean(status?.loading) || busy;
    return (
      <div
        key={option.id}
        className={cn(
          'flex flex-col gap-4 rounded-[8px] border p-4',
          active
            ? 'border-[var(--hg-brand)] ring-2 ring-[var(--hg-brand)]/25'
            : 'border-[var(--hg-border)]',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--hg-ink)]">{copy.title}</p>
            <p className="mt-0.5 text-sm text-[var(--hg-muted)]">{copy.description}</p>
          </div>
          {active ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--hg-brand)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              In use
            </span>
          ) : loading ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--hg-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading…
            </span>
          ) : !option.configured ? (
            <span className="shrink-0 text-xs font-medium text-[var(--hg-muted)]">
              Not configured
            </span>
          ) : null}
        </div>

        {option.configured ? (
          <dl className="space-y-1.5 text-xs">
            {Object.entries(option.models).map(([key, model]) => (
              <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-[var(--hg-muted)] sm:w-28">{ROUTE_LABELS[key] ?? key}</dt>
                <dd className="min-w-0 break-all font-mono text-[var(--hg-ink)]">{model}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-[var(--hg-muted)]">{envVarHint(option.id)}</p>
        )}

        <div className="mt-auto">
          <Button
            type="button"
            variant={active ? 'outline' : 'default'}
            className={settingsFormActionClass}
            disabled={disabled}
            onClick={() => setConfirmTarget(option.id)}
          >
            {active ? 'In use' : `Switch to ${copy.title.toLowerCase()}`}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--hg-border)] bg-white shadow-[var(--hg-shadow)]"
      aria-labelledby="model-set-manager-title"
    >
      <div className={settingsSectionHeaderClass}>
        <h2
          id="model-set-manager-title"
          className="font-heading text-base font-semibold text-[var(--hg-ink)]"
        >
          Model set
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--hg-muted)]">
          Choose which published models this server uses for{' '}
          <span className="font-medium text-[var(--hg-ink)]">every organization</span>: new
          classifications, explanations and performance metrics. Posts already classified keep
          their labels.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--hg-subtle)]" />
        </div>
      ) : isError || !status ? (
        <p className="px-6 py-8 text-sm text-destructive" role="alert">
          {parseApiError(error)}
        </p>
      ) : (
        <div className="space-y-4 px-6 py-6">
          {status.loading ? (
            <p className="flex items-start gap-2 rounded-[8px] border border-[var(--hg-border)] bg-[var(--hg-soft)] px-3 py-2.5 text-sm text-[var(--hg-ink)]" role="status">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>
                Loading the {MODEL_SET_COPY[status.loading].title.toLowerCase()} models. The first
                time, the server downloads about 3.3 GB, which can take several minutes. The
                current models keep serving until the switch completes.
              </span>
            </p>
          ) : null}
          {notice && !status.loading ? (
            <p className="text-sm font-medium text-[var(--hg-brand)]" role="status">{notice}</p>
          ) : null}
          {status.error ? (
            <p className="text-sm text-destructive" role="alert">{status.error}</p>
          ) : null}
          {requestError ? (
            <p className="text-sm text-destructive" role="alert">{requestError}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">{status.options.map(renderOption)}</div>

          <p className="text-xs text-[var(--hg-muted)]">
            Server default (HF_MODEL_SET):{' '}
            <span className="font-medium text-[var(--hg-ink)]">{status.env_default ?? 'not set'}</span>
            {status.saved ? (
              <>
                {' '}· Saved choice:{' '}
                <span className="font-medium text-[var(--hg-ink)]">{status.saved}</span> (kept
                after the API restarts)
              </>
            ) : null}
            {status.active === null ? (
              <> · In use: the default model IDs, because nothing is selected yet</>
            ) : null}
          </p>
        </div>
      )}

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => !open && !busy && setConfirmTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {confirmTarget ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Switch every organization to the {MODEL_SET_COPY[confirmTarget].title.toLowerCase()} models?
                </DialogTitle>
                <DialogDescription>
                  New classifications, explanations and performance metrics will use these models
                  for all users. Posts already classified keep the labels and probabilities they
                  were given. Avoid switching during a study session.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={busy} onClick={handleConfirm}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Switch
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

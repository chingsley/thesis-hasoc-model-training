import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FilePlusCorner, Loader2, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge, labelBadgeVariant } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfidenceMeter } from '@/components/explainability/ConfidenceMeter';
import { ExplanationComparison } from '@/components/explainability/ExplanationComparison';
import { PlainExplanation } from '@/components/explainability/PlainExplanation';
import { usePostExplanation } from '@/hooks/use-explanations';
import { useViewMode } from '@/lib/store/view-mode';
import { certaintyPhrase, toLabel } from '@/lib/plain-language';
import { useDashboardStore } from '@/lib/store/dashboard';
import { singleClassify } from '@/lib/api/client';
import { useActiveModel } from '@/hooks/use-active-model';
import { validatePredictionText } from '@/lib/prediction-text-validation';
import { LABEL_SERIES_COLOR } from '@/lib/label-series';
import { cn } from '@/lib/utils';
import type { ExplainTarget, Language } from '@/lib/types';

/**
 * Timing shared by the split animation, so the composer and the result pane move together.
 * Kept as one literal so Tailwind sees every class.
 */
const SPLIT_MOTION = 'duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';

const PROB_ROWS = [
  { key: 'normal' as const, label: 'Normal', fill: LABEL_SERIES_COLOR.Normal },
  { key: 'abuse' as const, label: 'Abuse', fill: LABEL_SERIES_COLOR.Abuse },
  { key: 'hate' as const, label: 'Hate', fill: 'var(--hg-matrix-error, #c1002c)' },
] as const;

function ProbabilityMeters({
  probabilities,
  predicted,
}: {
  probabilities: { normal: number; abuse: number; hate: number; };
  predicted: string;
}) {
  return (
    <div className="space-y-2.5">
      {PROB_ROWS.map((row) => {
        const value = probabilities[row.key];
        const pct = Math.round(value * 1000) / 10;
        const isTop = predicted.toLowerCase() === row.key;
        return (
          <div key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  'text-xs font-medium',
                  isTop ? 'text-[var(--hg-ink)]' : 'text-[var(--hg-muted)]',
                )}
              >
                {row.label}
                {isTop ? (
                  <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-[var(--hg-brand)] uppercase">
                    Predicted
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--hg-muted)]">
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hg-canvas)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  backgroundColor: row.fill,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewDocumentButton({ onClick }: { onClick: () => void; }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={250}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New document"
            onClick={onClick}
            className="shrink-0 rounded-[4px] text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-[var(--hg-ink)]"
          />
        }
      >
        <FilePlusCorner className="size-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent>New document</TooltipContent>
    </Tooltip>
  );
}

const languageName = (value: Language) => (value === 'igbo' ? 'Igbo' : 'Yoruba');

export function TextTester() {
  const language = useDashboardStore((s) => s.language);
  const languageLabel = languageName(language);
  const { modelSet } = useActiveModel();
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  // The page opens with the composer centred; the first Analyze splits it into message | result,
  // and it stays split for later documents.
  const [split, setSplit] = useState(false);
  // Bumped by New document, to focus the empty editor (never on first load, so the page does not
  // grab focus).
  const [newDocumentCount, setNewDocumentCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const viewMode = useViewMode();

  const mutation = useMutation({
    // The language is part of the request, so a later switch in the header does not change
    // which model the shown result (and its explanation) belongs to.
    mutationFn: (input: { text: string; language: Language; }) =>
      singleClassify(input.text, input.language),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview-stats'] });
      queryClient.invalidateQueries({ queryKey: ['volume'] });
    },
  });

  const result = mutation.data;
  const submitted = mutation.variables;
  const predictedLabel = result ? toLabel(result.predicted_label) : null;

  // Explanations come from the local Afro-XLMR models, so there are none when the label came
  // from OpenAI Moderation.
  const explainTarget = useMemo<ExplainTarget | null>(() => {
    if (!result || !submitted || !predictedLabel || result.use_openai_moderation) return null;
    return {
      id: `adhoc:${submitted.language}:${submitted.text}`,
      tweet: submitted.text,
      language: submitted.language,
      label: predictedLabel,
      predicted_label: predictedLabel,
      adHoc: true,
    };
  }, [result, submitted, predictedLabel]);
  const { explanation, loadingMethods, loading: explanationLoading } = usePostExplanation(explainTarget);
  const unavailableReason = result?.use_openai_moderation
    ? 'Explanations are not available in OpenAI Moderation mode, because the label comes from OpenAI and not from HateGuard’s own model.'
    : undefined;

  const topConfidence = useMemo(() => {
    if (!result) return null;
    const key = result.predicted_label.toLowerCase() as 'normal' | 'abuse' | 'hate';
    const value = result.probabilities[key] ?? Math.max(
      result.probabilities.normal,
      result.probabilities.abuse,
      result.probabilities.hate,
    );
    return Math.round(value * 100);
  }, [result]);

  useEffect(() => {
    if (newDocumentCount > 0) textareaRef.current?.focus();
  }, [newDocumentCount]);

  // The left pane shows the sent text while it is being classified and once it has a result. After
  // a failed request it goes back to the editor with the draft, so the user can fix it or retry.
  const showPreview = submitted !== undefined && (mutation.isPending || mutation.isSuccess);
  const paneLanguageLabel = showPreview ? languageName(submitted.language) : languageLabel;
  const resultHint =
    viewMode === 'plain'
      ? 'Run Analyze to see the label, how sure HateGuard is, and the words behind the decision.'
      : 'Run Analyze to see the predicted label, class probabilities, and the explanation methods.';

  const runAnalyze = () => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    let validated: string;
    try {
      validated = validatePredictionText(trimmed);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Invalid text.');
      // A failure from an earlier request no longer describes this text.
      if (mutation.isError) mutation.reset();
      return;
    }
    setValidationError(null);
    setSplit(true);
    mutation.mutate({ text: validated, language });
  };

  const startNewDocument = () => {
    mutation.reset();
    setText('');
    setValidationError(null);
    setNewDocumentCount((n) => n + 1);
  };

  return (
    <div className="@container animate-in fade-in duration-300">
      {/*
        Two tracks from the start: the result track is 0fr until the first Analyze, then both
        become 1fr, and the browser animates grid-template-columns between them. Below @2xl the
        panes stack instead.
      */}
      <div
        className={cn(
          'grid grid-cols-1 items-start gap-y-5 [--split-gap:1.5rem]',
          'transition-[grid-template-columns,column-gap]',
          SPLIT_MOTION,
          split
            ? '@2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @2xl:gap-x-(--split-gap)'
            : '@2xl:grid-cols-[minmax(0,1fr)_minmax(0,0fr)] @2xl:gap-x-0',
        )}
      >
        <div
          className={cn(
            'mx-auto w-full min-w-0 space-y-5 transition-[max-width]',
            SPLIT_MOTION,
            split ? 'max-w-full' : 'max-w-3xl',
          )}
        >
          <div className="overflow-hidden rounded-[4px] border border-[var(--hg-border)]">
            <div className="border-b border-[var(--hg-border)] bg-[var(--hg-canvas)]/50 px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {split ? <NewDocumentButton onClick={startNewDocument} /> : null}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--hg-ink)]">
                      {showPreview ? 'Your message' : 'Message to classify'}
                    </p>
                    <p className="text-[11px] text-[var(--hg-muted)]">
                      {showPreview ? (
                        'Start a new document to check another message.'
                      ) : (
                        <>
                          Paste real {languageLabel} sentences (at least 10 characters, not numbers
                          or ids). The model is trained on social text — garbage input produces
                          unreliable labels.
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-[4px] bg-white px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--hg-brand)] uppercase ring-1 ring-[var(--hg-border)]">
                  {paneLanguageLabel}
                </span>
              </div>
            </div>

            {showPreview ? (
              // Same box and type as the editor and no fade, so sending reads as the editor locking
              // in place rather than the text blinking.
              <div className="max-h-[420px] min-h-[140px] overflow-y-auto bg-white px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--hg-ink)]">
                {submitted.text}
              </div>
            ) : (
              <Textarea
                ref={textareaRef}
                placeholder={`e.g. a ${languageLabel} message you want to check for hate or abuse…`}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setValidationError(null);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runAnalyze();
                  }
                }}
                className={cn(
                  'min-h-[140px] resize-y rounded-none border-0 bg-white px-4 py-3 text-sm leading-relaxed',
                  'shadow-none focus-visible:border-transparent focus-visible:ring-0',
                  'placeholder:text-[var(--hg-subtle)]',
                )}
              />
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--hg-border)] bg-white px-4 py-3">
              {showPreview && mutation.isSuccess ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startNewDocument}
                  className="h-8 rounded-[4px] border-[var(--hg-border)]"
                >
                  <FilePlusCorner className="size-3.5" aria-hidden />
                  New document
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={runAnalyze}
                  disabled={!text.trim() || mutation.isPending}
                  className="h-8 rounded-[4px] bg-[var(--hg-brand)] px-3 text-white hover:bg-[var(--hg-brand)]/90"
                >
                  {mutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {mutation.isPending ? 'Analyzing…' : 'Analyze'}
                </Button>
              )}
              <p className="text-[11px] text-[var(--hg-muted)]">
                <span className="font-mono tabular-nums text-[var(--hg-ink)]">
                  {showPreview ? submitted.text.length : text.trim().length}
                </span>{' '}
                characters
                {showPreview ? null : (
                  <>
                    <span className="mx-1.5 text-[var(--hg-subtle)]">·</span>
                    ⌘/Ctrl + Enter to run
                  </>
                )}
              </p>
            </div>
          </div>

          {validationError && (
            <div
              className="rounded-[4px] border border-amber-500/40 bg-amber-500/5 px-4 py-3"
              role="alert"
            >
              <p className="text-sm font-medium text-[var(--hg-ink)]">Text not accepted</p>
              <p className="mt-0.5 text-xs text-[var(--hg-muted)]">{validationError}</p>
            </div>
          )}

          {split ? null : (
            <p className="text-center text-xs text-[var(--hg-muted)]">{resultHint}</p>
          )}
        </div>

        {split ? (
          <div className="min-w-0">
            {/*
              Pinned to the final half width (100cqw is this tester's width), so the content does
              not reflow while its track grows; it slides in from the right instead.
            */}
            <div className="w-full animate-in fade-in duration-500 @2xl:w-[calc((100cqw_-_var(--split-gap))_/_2)]">
              {mutation.isPending ? (
                <div
                  role="status"
                  className="flex animate-in flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[var(--hg-border)] px-4 py-12 text-center fade-in duration-300"
                >
                  <Loader2 className="size-5 animate-spin text-[var(--hg-subtle)]" aria-hidden />
                  <p className="text-sm font-medium text-[var(--hg-ink)]">Analyzing your message…</p>
                  <p className="max-w-sm text-xs text-[var(--hg-muted)]">
                    The result will appear here.
                  </p>
                </div>
              ) : mutation.isError ? (
                <div className="animate-in rounded-[4px] border border-[var(--hg-secondary)]/25 bg-[var(--hg-secondary)]/5 px-4 py-3 fade-in duration-300">
                  <p className="text-sm font-medium text-[var(--hg-secondary)]">Classification failed</p>
                  <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                    Check that the backend is running and reachable via the Vite proxy, then try again.
                  </p>
                </div>
              ) : result ? (
                <div className="animate-in space-y-4 fade-in duration-300">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--hg-border)] pb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                        Prediction
                      </p>
                      <div className="mt-1">
                        <Badge
                          variant={labelBadgeVariant(result.predicted_label)}
                          className="rounded-[4px] px-2.5 py-0.5 text-sm font-semibold"
                        >
                          {result.predicted_label}
                        </Badge>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                        Confidence
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-[var(--hg-ink)]">
                        {topConfidence}%
                      </p>
                      <p className="text-[10px] text-[var(--hg-muted)]">
                        {viewMode === 'plain' && topConfidence !== null
                          ? certaintyPhrase(topConfidence / 100)
                          : 'Top-class probability'}
                      </p>
                    </div>
                    {result.model_id && (
                      <div className="min-w-0 sm:ml-auto sm:text-right">
                        <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                          Model
                        </p>
                        <p className="max-w-[14rem] truncate font-mono text-[11px] text-[var(--hg-muted)]" title={result.model_id}>
                          {result.model_id}
                        </p>
                        {modelSet ? (
                          <p className="text-[10px] text-[var(--hg-muted)]">
                            {modelSet === 'merged' ? 'Merged-dataset model' : 'Original-dataset model'}
                          </p>
                        ) : null}
                        {result.use_openai_moderation ? (
                          <p className="text-[10px] font-medium text-sky-700">OpenAI Moderation</p>
                        ) : result.used_fallback ? (
                          <p className="text-[10px] text-amber-600">Joint fallback</p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--hg-ink)]">Explanation</h3>
                      <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                        {viewMode === 'plain'
                          ? 'Why HateGuard gave this text its label.'
                          : 'Class probabilities and the four explanation methods for this text.'}
                      </p>
                    </div>

                    {viewMode === 'plain' ? (
                      <PlainExplanation
                        text={submitted?.text ?? ''}
                        label={predictedLabel ?? 'Normal'}
                        probabilities={result.probabilities}
                        explanation={explanation}
                        loading={explanationLoading}
                        unavailableReason={unavailableReason}
                        decisionTechnicalName="Class probabilities"
                      />
                    ) : (
                      <div className="space-y-8">
                        <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--hg-ink)]">Class probabilities</h3>
                            <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                              How the model distributed probability across labels.
                            </p>
                          </div>
                          <ProbabilityMeters
                            probabilities={result.probabilities}
                            predicted={result.predicted_label}
                          />
                        </div>
                        {explanation ? (
                          <>
                            <ConfidenceMeter metrics={explanation.metrics} loading={explanationLoading} />
                            <ExplanationComparison
                              explanation={explanation}
                              loadingMethods={loadingMethods}
                              singleColumn
                            />
                          </>
                        ) : (
                          <div className="rounded-[4px] border border-dashed border-[var(--hg-border)] px-3 py-6 text-center">
                            <p className="text-xs text-[var(--hg-muted)]">
                              {unavailableReason ?? 'No explanation is available for this text.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex animate-in flex-col items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-[var(--hg-border)] px-4 py-12 text-center fade-in duration-300">
                  <Sparkles className="size-5 text-[var(--hg-subtle)]" aria-hidden />
                  <p className="text-sm font-medium text-[var(--hg-ink)]">No result yet</p>
                  <p className="max-w-sm text-xs text-[var(--hg-muted)]">{resultHint}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

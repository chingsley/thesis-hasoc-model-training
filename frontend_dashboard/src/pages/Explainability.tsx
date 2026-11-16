import { useEffect, useMemo, useState } from 'react'
import { useExplainabilityPosts } from '@/hooks/use-posts'
import { usePostExplanation } from '@/hooks/use-explanations'
import { ExplanationView } from '@/components/explainability/ExplanationView'
import { ViewModeToggle } from '@/components/ui/view-mode-toggle'
import { useViewMode } from '@/lib/store/view-mode'
import {
  TriagePredictionLabelFilter,
  type TriageLabelFilter,
} from '@/components/dashboard/TriageTable'
import { PostQueryToolbar, PostRangeFilterMenu } from '@/components/dashboard/PostQueryToolbar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PostIdCell, PredictionCell, truncateToWords } from '@/components/dashboard/post-cells'
import { cn } from '@/lib/utils'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { filterTriagePosts } from '@/lib/triage-buckets'
import { modelPrediction } from '@/lib/post-labels'
import type { ExplainTarget, Post } from '@/lib/types'
import { Loader2, ChevronRight } from 'lucide-react'

function postPreviewText(text: string): { line: string; isPlaceholder: boolean } {
  const trimmed = text.trim()
  if (!trimmed) {
    return { line: 'No post text saved', isPlaceholder: true }
  }
  const line = truncateToWords(trimmed, 20)
  const isPlaceholder = trimmed.length <= 2 && /^\d+$/.test(trimmed)
  return { line: isPlaceholder ? `“${trimmed}” — short or test input` : line, isPlaceholder }
}

export default function Explainability() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [labelFilter, setLabelFilter] = useState<TriageLabelFilter>('all')
  const { data: posts, isLoading } = useExplainabilityPosts(labelFilter)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minHate, setMinHate] = useState('')
  const [maxHate, setMaxHate] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(handle)
  }, [search])

  const hateMin = minHate === '' ? undefined : Number(minHate) / 100
  const hateMax = maxHate === '' ? undefined : Number(maxHate) / 100

  const filteredPosts = useMemo(() => {
    const list = posts ?? []
    return filterTriagePosts(list, {
      q: debouncedSearch.trim() || undefined,
      since: startDate || undefined,
      until: endDate || undefined,
      hateMin: hateMin != null && !Number.isNaN(hateMin) ? hateMin : undefined,
      hateMax: hateMax != null && !Number.isNaN(hateMax) ? hateMax : undefined,
    })
  }, [
    posts,
    debouncedSearch,
    startDate,
    endDate,
    hateMin,
    hateMax,
  ])

  useEffect(() => {
    if (selectedPost && !filteredPosts.some((p) => p.id === selectedPost.id)) {
      setSelectedPost(null)
    }
  }, [filteredPosts, selectedPost])

  const explainTarget = useMemo<ExplainTarget | null>(
    () =>
      selectedPost
        ? {
            id: selectedPost.id,
            tweet: selectedPost.tweet,
            language: selectedPost.language,
            label: selectedPost.label,
            predicted_label: modelPrediction(selectedPost),
          }
        : null,
    [selectedPost],
  )
  const { explanation, loadingMethods, loading: explanationLoading } = usePostExplanation(explainTarget)
  const viewMode = useViewMode()

  const totalLoaded = posts?.length ?? 0
  const showing = filteredPosts.length
  const hasActiveFilters =
    labelFilter !== 'all' ||
    debouncedSearch.trim() !== '' ||
    startDate ||
    endDate ||
    minHate ||
    maxHate

  return (
    <div className="space-y-8">
      <SectionTitle
        description={
          <>
            <span className="block">
              {viewMode === 'plain'
                ? 'See why HateGuard gave a post its label.'
                : 'Inspect model decisions token by token with LIME, SHAP, Attention Rollout, and Integrated Gradients.'}
            </span>
            <span className="mt-1 block">
              {viewMode === 'plain'
                ? 'Find a classified post, then open it to see the words behind its label.'
                : 'Find a classified post, then open it for token-level explanations.'}
            </span>
          </>
        }
      >
        Explainability
      </SectionTitle>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-stretch">
        <Card
          className="flex min-h-0 flex-col overflow-hidden xl:col-span-5 xl:h-[min(720px,calc(100dvh-11rem))]"
        >
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-5 pt-0">
            <div className="shrink-0 space-y-3">
              <PostQueryToolbar
                searchFullWidth
                hideRangeFilter
                search={search}
                onSearchChange={setSearch}
                startDate={startDate}
                endDate={endDate}
                minHate={minHate}
                maxHate={maxHate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onMinHateChange={setMinHate}
                onMaxHateChange={setMaxHate}
                filterHint="Date range and hate probability"
              />
              <div className="flex min-w-0 items-stretch gap-2.5">
                <TriagePredictionLabelFilter
                  layout="fullWidth"
                  size="comfortable"
                  className="min-w-0 flex-1"
                  labelFilter={labelFilter}
                  onLabelFilterChange={setLabelFilter}
                />
                <PostRangeFilterMenu
                  size="comfortable"
                  showClearButton={false}
                  startDate={startDate}
                  endDate={endDate}
                  minHate={minHate}
                  maxHate={maxHate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                  onMinHateChange={setMinHate}
                  onMaxHateChange={setMaxHate}
                  filterHint="Date range and hate probability"
                />
              </div>
            </div>

            {!isLoading && totalLoaded > 0 && (
              <div
                className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-[var(--hg-muted)]"
                aria-live="polite"
              >
                <p>
                  <span className="font-medium tabular-nums text-[var(--hg-ink)]">{showing}</span>
                  {hasActiveFilters ? (
                    <>
                      {' '}
                      of <span className="tabular-nums">{totalLoaded}</span> loaded
                    </>
                  ) : null}{' '}
                  {showing === 1 ? 'post' : 'posts'}
                  {totalLoaded >= 500 ? ' · newest 500' : null}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="font-medium text-[var(--hg-brand)] hover:underline"
                    onClick={() => {
                      setLabelFilter('all')
                      setSearch('')
                      setStartDate('')
                      setEndDate('')
                      setMinHate('')
                      setMaxHate('')
                    }}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--hg-muted)]" />
                </div>
              ) : showing === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--hg-ink)]">No posts match</p>
                  <p className="mt-1.5 text-xs text-[var(--hg-muted)]">
                    {totalLoaded === 0
                      ? 'Classify text under Classify Posts to build your prediction log.'
                      : 'Try clearing search or filters, or choose a different prediction label.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--hg-border)]" role="listbox" aria-label="Posts">
                  {filteredPosts.map((post) => {
                    const selected = selectedPost?.id === post.id
                    const prediction = modelPrediction(post)
                    const { line, isPlaceholder } = postPreviewText(post.tweet)
                    const hatePct = Math.round(post.probabilities.hate * 100)
                    return (
                      <button
                        key={post.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setSelectedPost(post)}
                        className={cn(
                          'group flex w-full gap-2.5 px-3 py-3 text-left transition-colors',
                          selected
                            ? 'bg-[var(--hg-soft)]/60'
                            : 'hover:bg-[var(--hg-canvas)]',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1 w-0.5 shrink-0 self-stretch rounded-full',
                            selected ? 'bg-[var(--hg-brand)]' : 'bg-transparent group-hover:bg-[var(--hg-border)]',
                          )}
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <PostIdCell id={post.id} />
                            <PredictionCell label={prediction} />
                            <span
                              className="text-[10px] tabular-nums text-[var(--hg-subtle)]"
                              title="Hate probability"
                            >
                              {hatePct}% hate
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-sm leading-snug',
                              isPlaceholder
                                ? 'text-[var(--hg-muted)] italic'
                                : selected
                                  ? 'font-medium text-[var(--hg-ink)]'
                                  : 'text-[var(--hg-ink)]',
                            )}
                            title={post.tweet}
                          >
                            {line}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            'size-4 shrink-0 self-center',
                            selected
                              ? 'text-[var(--hg-brand)]'
                              : 'text-[var(--hg-subtle)] group-hover:text-[var(--hg-muted)]',
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card
          className="flex min-h-0 flex-col overflow-hidden xl:col-span-7 xl:h-[min(720px,calc(100dvh-11rem))]"
        >
          <CardHeader className="shrink-0 border-b border-[var(--hg-border)] pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle
                size="md"
                description={
                  viewMode === 'plain'
                    ? selectedPost
                      ? 'Why HateGuard gave this post its label.'
                      : 'Pick a post to see why HateGuard gave it its label.'
                    : selectedPost
                      ? 'Side-by-side XAI methods for the selected post.'
                      : 'Pick a post to compare explanation methods.'
                }
              >
                {selectedPost
                  ? `Explanation for ${selectedPost.id}`
                  : viewMode === 'plain'
                    ? 'Explanation'
                    : 'Explanation Comparison'}
              </SectionTitle>
              <ViewModeToggle />
            </div>
            {selectedPost ? (
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--hg-muted)]">
                {selectedPost.tweet}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-5 pb-5">
            {explanation && selectedPost ? (
              <ExplanationView
                text={selectedPost.tweet}
                label={explanation.label}
                probabilities={selectedPost.probabilities}
                explanation={explanation}
                loadingMethods={loadingMethods}
                loading={explanationLoading}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)] px-6 py-16 text-center">
                <p className="text-sm font-medium text-[var(--hg-ink)]">
                  Select a post to inspect explanations
                </p>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--hg-muted)]">
                  {viewMode === 'plain'
                    ? 'You will see the label, how sure HateGuard is, and the words that led to it.'
                    : 'Compare LIME, SHAP, Attention Rollout, and Integrated Gradients token by token.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

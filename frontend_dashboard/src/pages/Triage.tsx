import { useEffect, useMemo, useState } from 'react'
import {
  useTriageStats,
  useTriagePostsPage,
  useRelabelPost,
} from '@/hooks/use-posts'
import {
  TriageTable,
  type TriageLabelFilter,
} from '@/components/dashboard/TriageTable'
import { TriageStats } from '@/components/dashboard/TriageStats'
import { RelabelSheet, type RelabelMode } from '@/components/dashboard/RelabelSheet'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TRIAGE_ALL_BUCKET_PAGE_SIZE, TRIAGE_PAGE_SIZE } from '@/lib/triage-buckets'
import type { Label, Post, TriageBucket } from '@/lib/types'
import { toast } from 'sonner'

const TABS: { value: TriageBucket; label: string }[] = [
  { value: 'pending', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'relabelled', label: 'Relabelled' },
]

export default function Triage() {
  const [activeBucket, setActiveBucket] = useState<TriageBucket>('pending')
  const [labelFilter, setLabelFilter] = useState<TriageLabelFilter>('all')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minHate, setMinHate] = useState('')
  const [maxHate, setMaxHate] = useState('')
  const [relabelState, setRelabelState] = useState<{ post: Post; mode: RelabelMode } | null>(null)
  const relabelMutation = useRelabelPost()

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(handle)
  }, [search])

  const hateMin = minHate === '' ? undefined : Number(minHate) / 100
  const hateMax = maxHate === '' ? undefined : Number(maxHate) / 100

  useEffect(() => {
    setPage(0)
  }, [activeBucket, labelFilter, debouncedSearch, startDate, endDate, minHate, maxHate])

  const { data: stats, isLoading: statsLoading } = useTriageStats()

  const pageSize =
    activeBucket === 'pending' ? TRIAGE_ALL_BUCKET_PAGE_SIZE : TRIAGE_PAGE_SIZE

  const postsQuery = useMemo(
    () => ({
      bucket: activeBucket,
      limit: pageSize,
      offset: page * pageSize,
      label: labelFilter === 'all' ? undefined : labelFilter,
      q: debouncedSearch.trim() || undefined,
      since: startDate || undefined,
      until: endDate || undefined,
      hateMin: hateMin != null && !Number.isNaN(hateMin) ? hateMin : undefined,
      hateMax: hateMax != null && !Number.isNaN(hateMax) ? hateMax : undefined,
    }),
    [
      activeBucket,
      page,
      pageSize,
      labelFilter,
      debouncedSearch,
      startDate,
      endDate,
      hateMin,
      hateMax,
    ],
  )

  const { data: postsPage, isLoading: postsLoading, isFetching } = useTriagePostsPage(postsQuery)

  const handleRelabelSave = async (label: Label, bucket?: 'flagged') => {
    if (!relabelState) return
    const { mode, post } = relabelState
    try {
      await relabelMutation.mutateAsync({
        postId: post.id,
        manualLabel: label,
        bucket,
      })
      if (mode === 'create') {
        const destination = bucket === 'flagged' ? 'Also flagged for incident report' : 'Saved in queue'
        toast.success(`Saved as ${label}`, { description: destination })
      } else {
        toast.success(`Manual label updated to ${label}`)
      }
    } catch (error) {
      toast.error('Couldn’t save changes', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
      throw error
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle description="Review Hate and Abuse predictions. Flag for incident reports or relabel for future retraining — flagged posts stay in the queue.">
        Triage Queue
      </SectionTitle>

      <div className="flex flex-col gap-8">
        <TriageStats bucket={activeBucket} stats={stats} loading={statsLoading && !stats} />

        <Card>
            <Tabs
              value={activeBucket}
              onValueChange={(value) => setActiveBucket(value as TriageBucket)}
              className="w-full gap-0"
            >
              <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
                <SectionTitle
                  size="md"
                  description="Search, filter, and act on posts in the selected bucket."
                >
                  Posts
                </SectionTitle>
                <CardAction className="flex flex-col items-end gap-2 self-center">
                  <TabsList className="h-auto w-fit justify-end gap-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5">
                    {TABS.map((tab) => {
                      const count = stats?.[tab.value]?.total
                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="group h-auto flex-none rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-[var(--hg-muted)] shadow-none transition-colors hover:bg-[var(--hg-soft)] hover:text-black data-active:bg-white data-active:text-[var(--hg-ink)] data-active:shadow-sm"
                        >
                          {tab.label}
                          <span className="ml-1.5 tabular-nums text-[var(--hg-subtle)] group-data-active:text-[var(--hg-brand)]">
                            {count != null ? count.toLocaleString() : '—'}
                          </span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </CardAction>
              </CardHeader>

              <CardContent className="pt-5">
                {TABS.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-0">
                    {tab.value === activeBucket && (
                      <TriageTable
                        bucket={activeBucket}
                        posts={postsPage?.items ?? []}
                        total={postsPage?.total ?? 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        bucketCounts={
                          stats?.[activeBucket] ?? {
                            total: 0,
                            normal: 0,
                            hate: 0,
                            abuse: 0,
                            normal_flagged: 0,
                            normal_relabelled: 0,
                            normal_other: 0,
                            hate_flagged: 0,
                            hate_relabelled: 0,
                            hate_other: 0,
                            abuse_flagged: 0,
                            abuse_relabelled: 0,
                            abuse_other: 0,
                          }
                        }
                        labelFilter={labelFilter}
                        onLabelFilterChange={setLabelFilter}
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
                        loading={postsLoading && !postsPage}
                        fetching={isFetching}
                        onRelabel={(post, mode) => setRelabelState({ post, mode })}
                      />
                    )}
                  </TabsContent>
                ))}
              </CardContent>
            </Tabs>
        </Card>
      </div>

      <RelabelSheet
        post={relabelState?.post ?? null}
        mode={relabelState?.mode ?? 'create'}
        saving={relabelMutation.isPending}
        onSave={handleRelabelSave}
        onClose={() => setRelabelState(null)}
      />
    </div>
  )
}

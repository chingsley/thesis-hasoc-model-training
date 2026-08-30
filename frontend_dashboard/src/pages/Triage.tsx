import { useMemo, useState } from 'react'
import { useTriagePosts, useRelabelPost } from '@/hooks/use-posts'
import {
  TriageTable,
  type TriageBucket,
  type TriageLabelFilter,
} from '@/components/dashboard/TriageTable'
import { TriageStats } from '@/components/dashboard/TriageStats'
import { RelabelSheet, type RelabelMode } from '@/components/dashboard/RelabelSheet'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Label, Post } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const TABS: { value: TriageBucket; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'relabelled', label: 'Relabelled' },
]

const LABEL_FILTERS: { id: TriageLabelFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Hate', label: 'Hate' },
  { id: 'Abuse', label: 'Abuse' },
]

export default function Triage() {
  const { data: posts, isLoading } = useTriagePosts()
  const [activeBucket, setActiveBucket] = useState<TriageBucket>('pending')
  const [labelFilter, setLabelFilter] = useState<TriageLabelFilter>('all')
  const [relabelState, setRelabelState] = useState<{ post: Post; mode: RelabelMode } | null>(null)
  const relabelMutation = useRelabelPost()

  const buckets = useMemo(() => {
    const all = posts ?? []
    return {
      pending: all.filter((p) => p.triage_status === 'pending'),
      cleared: all.filter((p) => p.triage_status === 'cleared'),
      flagged: all.filter((p) => p.triage_status === 'flagged'),
      relabelled: all.filter((p) => p.manual_label && p.manual_label !== p.predicted_label),
    }
  }, [posts])

  const activePosts = buckets[activeBucket]
  const labelCounts = useMemo(
    () => ({
      all: activePosts.length,
      Hate: activePosts.filter((p) => p.predicted_label === 'Hate').length,
      Abuse: activePosts.filter((p) => p.predicted_label === 'Abuse').length,
    }),
    [activePosts],
  )

  const handleRelabelSave = async (label: Label, bucket?: 'cleared' | 'flagged') => {
    if (!relabelState) return
    await relabelMutation.mutateAsync({
      postId: relabelState.post.id,
      manualLabel: label,
      bucket,
    })
  }

  return (
    <div className="space-y-8">
      <SectionTitle description="Review Hate and Abuse predictions. Flag for incident reports, clear after review, or relabel for future retraining.">
        Triage Queue
      </SectionTitle>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <TriageStats bucket={activeBucket} posts={buckets[activeBucket]} />

          <Card>
            <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
              <SectionTitle
                size="md"
                description="Search, filter, and act on posts in the selected bucket."
              >
                Posts
              </SectionTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs
                value={activeBucket}
                onValueChange={(value) => setActiveBucket(value as TriageBucket)}
                className="w-full gap-0"
              >
                <div className="flex items-center gap-3 border-b border-[var(--hg-border)]">
                  <TabsList
                    variant="line"
                    className="h-auto min-w-0 flex-1 justify-start gap-0 rounded-none border-0 bg-transparent p-0"
                  >
                    {TABS.map((tab) => {
                      const count = buckets[tab.value].length
                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="group relative h-11 flex-none rounded-none border-0 bg-transparent px-4 text-sm font-medium text-[var(--hg-muted)] shadow-none transition-colors hover:text-[var(--hg-ink)] data-active:bg-transparent data-active:text-[var(--hg-ink)] data-active:shadow-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--hg-brand)] after:opacity-0 after:transition-opacity data-active:after:opacity-100"
                        >
                          {tab.label}
                          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-[4px] bg-[var(--hg-canvas)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--hg-muted)] group-data-active:bg-[var(--hg-soft)] group-data-active:text-[var(--hg-brand)]">
                            {count}
                          </span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>

                  <div
                    className="mr-0 mb-1.5 ml-auto inline-flex w-fit shrink-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5"
                    role="group"
                    aria-label="Filter by prediction"
                  >
                    {LABEL_FILTERS.map((f) => {
                      const active = labelFilter === f.id
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setLabelFilter(f.id)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors',
                            active
                              ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                              : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
                          )}
                        >
                          {f.label}
                          <span
                            className={cn(
                              'tabular-nums',
                              active ? 'text-[var(--hg-brand)]' : 'text-[var(--hg-subtle)]',
                            )}
                          >
                            {labelCounts[f.id]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {TABS.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-5">
                    <TriageTable
                      bucket={tab.value}
                      posts={buckets[tab.value]}
                      labelFilter={labelFilter}
                      onRelabel={(post, mode) => setRelabelState({ post, mode })}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

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

import { useMemo, useState } from 'react'
import { useTriagePosts, useRelabelPost } from '@/hooks/use-posts'
import {
  TriageTable,
  type TriageBucket,
  type TriageLabelFilter,
} from '@/components/dashboard/TriageTable'
import { TriageStats } from '@/components/dashboard/TriageStats'
import { RelabelSheet, type RelabelMode } from '@/components/dashboard/RelabelSheet'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Label, Post } from '@/lib/types'
import { Loader2 } from 'lucide-react'

const TABS: { value: TriageBucket; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'relabelled', label: 'Relabelled' },
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
                      const count = buckets[tab.value].length
                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="group h-auto flex-none rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-[var(--hg-muted)] shadow-none transition-colors hover:bg-[var(--hg-soft)] hover:text-black data-active:bg-white data-active:text-[var(--hg-ink)] data-active:shadow-sm"
                        >
                          {tab.label}
                          <span className="ml-1.5 tabular-nums text-[var(--hg-subtle)] group-data-active:text-[var(--hg-brand)]">
                            {count}
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
                    <TriageTable
                      bucket={tab.value}
                      posts={buckets[tab.value]}
                      labelFilter={labelFilter}
                      onLabelFilterChange={setLabelFilter}
                      onRelabel={(post, mode) => setRelabelState({ post, mode })}
                    />
                  </TabsContent>
                ))}
              </CardContent>
            </Tabs>
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

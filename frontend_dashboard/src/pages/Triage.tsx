import { useMemo, useState } from 'react'
import { useTriagePosts, useRelabelPost } from '@/hooks/use-posts'
import { TriageTable, type TriageBucket } from '@/components/dashboard/TriageTable'
import { RelabelSheet, type RelabelMode } from '@/components/dashboard/RelabelSheet'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
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
  const [relabelState, setRelabelState] = useState<{ post: Post; mode: RelabelMode } | null>(null)
  const relabelMutation = useRelabelPost()

  // Buckets are views over the same per-user toxic predictions (Hate/Abuse).
  // pending/cleared/flagged are mutually exclusive (status); relabelled is an
  // additional view for posts whose manual label differs from the model's.
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <SectionTitle>Triage Queue</SectionTitle>
          <CardDescription>
            Your Hate/Abuse predictions, sorted into buckets. <strong>Flag</strong> sends a post to
            the incident report (Reports → Export Report); <strong>Clear</strong> marks it reviewed;
            <strong> Relabel</strong> corrects the model’s label (saved for future retraining).
            Reopen/Unflag return a post to Pending.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="w-full justify-start">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label} ({buckets[tab.value].length})
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-4">
                  <TriageTable
                    bucket={tab.value}
                    posts={buckets[tab.value]}
                    onRelabel={(post, mode) => setRelabelState({ post, mode })}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

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

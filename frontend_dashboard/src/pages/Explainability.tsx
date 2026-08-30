import { useState } from 'react'
import { useTriagePosts } from '@/hooks/use-posts'
import { useExplanationMethods, XAI_METHODS } from '@/hooks/use-explanations'
import { ExplanationComparison } from '@/components/explainability/ExplanationComparison'
import { ConfidenceMeter } from '@/components/explainability/ConfidenceMeter'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { crossMethodAgreementMean } from '@/lib/explain-agreement'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge, labelBadgeVariant } from '@/components/ui/badge'
import type { ExplanationPayload, Post, XaiMethod } from '@/lib/types'
import { Loader2, ChevronRight } from 'lucide-react'

export default function Explainability() {
  const { data: posts, isLoading } = useTriagePosts()
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const methodQueries = useExplanationMethods(selectedPost)

  let explanation: ExplanationPayload | null = null
  let loadingMethods: XaiMethod[] = []
  if (selectedPost) {
    const mergedMethods: ExplanationPayload['methods'] = {}
    const metrics: ExplanationPayload['metrics'] = {}
    methodQueries.forEach((query) => {
      if (query.data) {
        Object.assign(mergedMethods, query.data.methods)
        Object.assign(metrics, query.data.metrics)
      }
    })
    const agreement = crossMethodAgreementMean(mergedMethods)
    if (agreement !== undefined) metrics.cross_method_agreement_mean = agreement
    loadingMethods = XAI_METHODS.filter((_, i) => methodQueries[i].isPending)
    explanation = {
      id: selectedPost.id,
      label: selectedPost.predicted_label,
      text: selectedPost.tweet,
      methods: mergedMethods,
      metrics,
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle description="Inspect model decisions token by token with LIME, SHAP, Attention Rollout, and Integrated Gradients.">
        Explainability
      </SectionTitle>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <SectionTitle size="md" description="Toxic posts from your triage queue.">
              Select a Post
            </SectionTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--hg-muted)]" />
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div
                  className="divide-y divide-[var(--hg-border)] pr-5"
                  role="listbox"
                  aria-label="Posts"
                >
                  {(posts ?? []).slice(0, 30).map((post) => {
                    const selected = selectedPost?.id === post.id
                    return (
                      <button
                        key={post.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setSelectedPost(post)}
                        className={`group flex w-full gap-3 px-1 py-3.5 pr-2 text-left transition-colors ${
                          selected
                            ? 'bg-[var(--hg-soft)]/50'
                            : 'hover:bg-[var(--hg-canvas)]'
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 w-0.5 shrink-0 self-stretch rounded-full transition-colors ${
                            selected ? 'bg-[var(--hg-brand)]' : 'bg-transparent group-hover:bg-[var(--hg-border)]'
                          }`}
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p
                            className={`line-clamp-2 text-sm leading-snug ${
                              selected ? 'font-medium text-[var(--hg-ink)]' : 'text-[var(--hg-ink)]'
                            }`}
                          >
                            {post.tweet}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-[var(--hg-subtle)]">
                              {post.id}
                            </span>
                            <span aria-hidden className="text-[var(--hg-border)]">
                              ·
                            </span>
                            <Badge
                              variant={labelBadgeVariant(post.predicted_label)}
                              className="rounded-[4px] text-[10px] font-semibold"
                            >
                              {post.predicted_label}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight
                          className={`mt-1 size-4 shrink-0 transition-colors ${
                            selected
                              ? 'text-[var(--hg-brand)]'
                              : 'text-[var(--hg-subtle)] group-hover:text-[var(--hg-muted)]'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle
              size="md"
              description={
                selectedPost
                  ? 'Side-by-side XAI methods for the selected post.'
                  : 'Pick a post to compare explanation methods.'
              }
            >
              {selectedPost ? `Explanation for ${selectedPost.id}` : 'Explanation Comparison'}
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {explanation ? (
              <div className="space-y-6">
                <ConfidenceMeter metrics={explanation.metrics} />
                <ExplanationComparison explanation={explanation} loadingMethods={loadingMethods} />
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <p>Select a post from the list to see its explanations</p>
                <p className="mt-1 text-sm">LIME, SHAP, Attention Rollout, and Integrated Gradients</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

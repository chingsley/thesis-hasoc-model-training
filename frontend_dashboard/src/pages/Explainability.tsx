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
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {(posts ?? []).slice(0, 30).map((post) => (
                    <button
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className={`w-full rounded-[8px] border p-3 text-left transition-colors ${
                        selectedPost?.id === post.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-2 flex-1 text-sm">{post.tweet}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {post.id}
                        </Badge>
                        <Badge variant={labelBadgeVariant(post.label)} className="text-xs">
                          {post.label}
                        </Badge>
                      </div>
                    </button>
                  ))}
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

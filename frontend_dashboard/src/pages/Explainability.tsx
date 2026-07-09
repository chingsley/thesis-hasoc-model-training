import { useState } from 'react'
import { useTriagePosts } from '@/hooks/use-posts'
import { useExplanation } from '@/hooks/use-explanations'
import { ExplanationComparison } from '@/components/explainability/ExplanationComparison'
import { ConfidenceMeter } from '@/components/explainability/ConfidenceMeter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import type { Post } from '@/lib/types'
import { Loader2, ChevronRight } from 'lucide-react'

export default function Explainability() {
  const { data: posts, isLoading } = useTriagePosts()
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const { data: explanation, isLoading: expLoading } = useExplanation(selectedPost)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Select a Post</CardTitle>
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
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedPost?.id === post.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm line-clamp-2 flex-1">{post.tweet}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{post.id}</Badge>
                        <Badge
                          variant={post.label === 'Hate' ? 'destructive' : post.label === 'Abuse' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
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
            <CardTitle>
              {selectedPost ? `Explanation for ${selectedPost.id}` : 'Side-by-Side Explanation Comparison'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : explanation ? (
              <div className="space-y-6">
                <ConfidenceMeter explanation={explanation} />
                <ExplanationComparison explanation={explanation} />
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Select a post from the list to see its explanations</p>
                <p className="text-sm mt-1">LIME, SHAP, Attention Rollout, and Integrated Gradients</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTriagePosts } from '@/hooks/use-posts'
import { useExplanation } from '@/hooks/use-explanations'
import { ExplanationComparison } from '@/components/explainability/ExplanationComparison'
import { ConfidenceMeter } from '@/components/explainability/ConfidenceMeter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { Post } from '@/lib/types'

export default function Explainability() {
  const { data: posts } = useTriagePosts('all')
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const activePost = selectedPost ?? posts?.[0] ?? null
  const { data: explanation, isLoading } = useExplanation(activePost)

  return (
    <div className="space-y-6">
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle>Side-by-Side Explanation Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={activePost?.id ?? ''}
            onValueChange={(id) => {
              const post = posts?.find((p) => p.id === id)
              if (post) setSelectedPost(post)
            }}
          >
            <SelectTrigger className="max-w-lg rounded-xl">
              <SelectValue placeholder="Select a post to explain..." />
            </SelectTrigger>
            <SelectContent>
              {posts?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  [{p.predicted_label}] {p.tweet.slice(0, 60)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {explanation && !isLoading && (
            <>
              <ConfidenceMeter explanation={explanation} />
              <ExplanationComparison explanation={explanation} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

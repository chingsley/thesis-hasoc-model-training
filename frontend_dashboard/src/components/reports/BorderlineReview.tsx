import type { Post } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface BorderlineReviewProps {
  posts: Post[]
}

export function BorderlineReview({ posts }: BorderlineReviewProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No borderline posts in the 40–60% Hate probability range</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {posts.length} posts where the model is uncertain (40–60% Hate probability)
      </p>
      {posts.map((post) => (
        <Card key={post.id} className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm mb-2">{post.tweet}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{post.id}</Badge>
              <Badge variant="default">{post.predicted_label}</Badge>
              <span className="text-xs font-mono text-muted-foreground">
                N:{(post.probabilities.normal * 100).toFixed(0)}% |
                A:{(post.probabilities.abuse * 100).toFixed(0)}% |
                H:{(post.probabilities.hate * 100).toFixed(0)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

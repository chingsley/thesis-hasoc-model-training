import { useBorderlinePosts } from '@/hooks/use-posts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, AlertTriangle } from 'lucide-react'

export function BorderlineReview() {
  const { data: posts, isLoading } = useBorderlinePosts()

  const labelVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Borderline Post Review Queue
          {posts && <span className="text-muted-foreground font-normal text-sm ml-2">({posts.length} posts)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No borderline posts found</p>
            <p className="text-xs mt-1">Posts with 40-60% confidence will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {posts.map((post) => (
                <div key={post.id} className="p-4 border border-border rounded-lg space-y-2">
                  <p className="text-sm">{post.tweet}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{post.id}</Badge>
                    <Badge variant={labelVariant(post.label)} className="text-xs">
                      True: {post.label}
                    </Badge>
                    <Badge variant={labelVariant(post.predicted_label)} className="text-xs">
                      Pred: {post.predicted_label}
                    </Badge>
                    <div className="flex gap-1 text-xs text-muted-foreground ml-auto">
                      <span className="px-1.5 py-0.5 bg-muted rounded">N:{(post.probabilities.normal * 100).toFixed(0)}%</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded">A:{(post.probabilities.abuse * 100).toFixed(0)}%</span>
                      <span className="px-1.5 py-0.5 bg-muted rounded">H:{(post.probabilities.hate * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hate probability in borderline range (40-60%) - model is uncertain. Manual review recommended.
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

import type { Post } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { TriageStatusBadge } from './TriageStatusBadge'
import { Button } from '@/components/ui/button'
import { Flag } from 'lucide-react'
import { useFlagPost } from '@/hooks/use-posts'

interface PostRowProps {
  post: Post
}

const labelColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
  Normal: 'secondary',
  Abuse: 'default',
  Hate: 'destructive',
}

export function PostRow({ post }: PostRowProps) {
  const flagMutation = useFlagPost()

  const hateProb = post.probabilities.hate

  return (
    <div className="flex items-center gap-4 p-4 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2 mb-1">{post.tweet}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{post.id}</Badge>
          <Badge variant={labelColors[post.predicted_label]} className="text-xs">
            {post.predicted_label}
          </Badge>
          {post.predicted_label !== post.label && (
            <Badge variant="outline" className="text-xs border-destructive text-destructive">
              True: {post.label}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground capitalize">{post.language}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  hateProb > 0.7 ? 'bg-red-500' : hateProb > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.round(hateProb * 100)}%` }}
              />
            </div>
            <span className="text-xs font-mono w-10">{Math.round(hateProb * 100)}%</span>
          </div>
        </div>
        <TriageStatusBadge status={post.triage_status} />
        <Button
          size="sm"
          variant={post.flagged ? 'secondary' : 'destructive'}
          disabled={post.flagged}
          onClick={() => flagMutation.mutate(post.id)}
        >
          <Flag className="h-3 w-3 mr-1" />
          {post.flagged ? 'Reported' : 'Flag'}
        </Button>
      </div>
    </div>
  )
}

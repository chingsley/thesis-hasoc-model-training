import { useSearchParams } from 'react-router-dom'
import { useTriagePosts } from '@/hooks/use-posts'
import { TriageTable } from '@/components/dashboard/TriageTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import type { Label } from '@/lib/types'

export default function Triage() {
  const [searchParams] = useSearchParams()
  const labelParam = searchParams.get('label') as Label | null
  const { data: posts, isLoading } = useTriagePosts(labelParam ?? 'all')

  return (
    <div className="space-y-6">
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            Flagging / Triage Queue
            {posts && <span className="text-muted-foreground font-normal">({posts.length} posts)</span>}
            {labelParam && <Badge variant="destructive">{labelParam} only</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TriageTable posts={posts ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

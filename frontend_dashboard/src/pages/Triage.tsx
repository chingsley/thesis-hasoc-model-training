import { useTriagePosts } from '@/hooks/use-posts'
import { TriageTable } from '@/components/dashboard/TriageTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function Triage() {
  const { data: posts, isLoading } = useTriagePosts()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Flagging / Triage Queue
            {posts && <span className="text-muted-foreground font-normal ml-2">({posts.length} posts)</span>}
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

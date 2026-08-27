import { useTriagePosts } from '@/hooks/use-posts'
import { TriageTable } from '@/components/dashboard/TriageTable'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Loader2 } from 'lucide-react'

export default function Triage() {
  const { data: posts, isLoading } = useTriagePosts()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <SectionTitle>
            Flagging / Triage Queue
            {posts && <span className="text-muted-foreground font-normal ml-2">({posts.length} posts)</span>}
          </SectionTitle>
          <CardDescription>
            Your Hate/Abuse predictions. Flagging a post marks it as reported and adds it to your
            incident report (Reports → Export Report).
          </CardDescription>
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

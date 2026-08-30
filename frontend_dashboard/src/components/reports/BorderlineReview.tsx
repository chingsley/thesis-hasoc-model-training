import { useBorderlinePosts } from '@/hooks/use-posts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from '@/components/dashboard/post-cells'
import type { Post } from '@/lib/types'
import { Loader2, AlertTriangle } from 'lucide-react'

const COLUMNS: DataTableColumn<Post>[] = [
  { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} /> },
  {
    id: 'post',
    header: 'Post',
    className: 'max-w-[28rem] whitespace-normal',
    cell: (p) => <PostTextCell text={p.tweet} />,
  },
  { id: 'prediction', header: 'Prediction', cell: (p) => <PredictionCell label={p.predicted_label} /> },
  {
    id: 'normal',
    header: 'Normal',
    cell: (p) => <span className="font-mono text-xs">{Math.round(p.probabilities.normal * 100)}%</span>,
  },
  {
    id: 'abuse',
    header: 'Abuse',
    cell: (p) => <span className="font-mono text-xs">{Math.round(p.probabilities.abuse * 100)}%</span>,
  },
  { id: 'hate', header: 'Hate probability', cell: (p) => <HateProbCell value={p.probabilities.hate} /> },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
]

export function BorderlineReview() {
  const { data: posts, isLoading } = useBorderlinePosts()

  return (
    <Card>
      <CardHeader>
        <SectionTitle
          size="md"
          className="items-center"
          description="Posts with 40–60% hate confidence — the model is uncertain. Review these in Triage if you want to flag them."
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Borderline Post Review Queue
            {posts && (
              <span className="text-sm font-normal text-muted-foreground">({posts.length} posts)</span>
            )}
          </span>
        </SectionTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable
            columns={COLUMNS}
            data={posts ?? []}
            getRowId={(p) => p.id}
            maxHeight="500px"
            empty={
              <div className="text-center py-8 text-muted-foreground">
                <p>No borderline posts found</p>
                <p className="text-xs mt-1">Posts with 40-60% confidence will appear here</p>
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

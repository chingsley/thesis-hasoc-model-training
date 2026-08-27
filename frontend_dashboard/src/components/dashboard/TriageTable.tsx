import { useState } from 'react'
import type { Post } from '@/lib/types'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TriageStatusBadge } from './TriageStatusBadge'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from './post-cells'
import { useFlagPost } from '@/hooks/use-posts'
import { Flag } from 'lucide-react'

interface TriageTableProps {
  posts: Post[]
}

const COLUMNS: DataTableColumn<Post>[] = [
  { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} /> },
  {
    id: 'post',
    header: 'Post',
    className: 'max-w-[28rem] whitespace-normal',
    cell: (p) => <PostTextCell text={p.tweet} />,
  },
  {
    id: 'prediction',
    header: 'Prediction',
    cell: (p) => (
      <div className="flex items-center gap-1.5">
        <PredictionCell label={p.predicted_label} />
        {p.predicted_label !== p.label && (
          <Badge variant="outline" className="text-xs border-destructive text-destructive">
            True: {p.label}
          </Badge>
        )}
      </div>
    ),
  },
  {
    id: 'hate',
    header: 'Hate probability',
    cell: (p) => <HateProbCell value={p.probabilities.hate} />,
  },
  { id: 'status', header: 'Status', cell: (p) => <TriageStatusBadge status={p.triage_status} /> },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
]

export function TriageTable({ posts }: TriageTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const flagMutation = useFlagPost()

  const filtered = posts.filter((p) => {
    const matchesSearch =
      !search || p.tweet.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
    const matchesStatus = statusFilter === 'all' || p.triage_status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => v !== null && setStatusFilter(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="reported">Reported</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={COLUMNS}
        data={filtered}
        getRowId={(p) => p.id}
        maxHeight="520px"
        empty={
          <div className="text-center py-12 text-muted-foreground">
            <p>No posts match your filters</p>
          </div>
        }
        actions={(post) => (
          <Button
            size="sm"
            variant={post.flagged ? 'outline' : 'default'}
            disabled={post.flagged || flagMutation.isPending}
            onClick={() => flagMutation.mutate(post.id)}
            className="min-w-[5.5rem] shadow-xs"
          >
            <Flag className="h-3 w-3" />
            {post.flagged ? 'Reported' : 'Flag'}
          </Button>
        )}
      />
    </div>
  )
}

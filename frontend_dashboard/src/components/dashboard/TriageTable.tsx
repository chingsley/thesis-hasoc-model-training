import type { Post } from '@/lib/types'
import { PostRow } from './PostRow'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'

interface TriageTableProps {
  posts: Post[]
}

export function TriageTable({ posts }: TriageTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No posts match your filters</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {filtered.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

import type { Post } from '@/lib/types'
import { PostRow } from './PostRow'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard'

interface TriageTableProps {
  posts: Post[]
}

export function TriageTable({ posts }: TriageTableProps) {
  const globalSearch = useDashboardStore((s) => s.searchQuery)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const effectiveSearch = search || globalSearch

  const filtered = posts.filter((p) => {
    const matchesSearch =
      !effectiveSearch ||
      p.tweet.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
      p.id.includes(effectiveSearch)
    const matchesStatus = statusFilter === 'all' || p.triage_status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs rounded-xl"
        />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[140px] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="reported">Reported</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} posts</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No posts match your filters</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl divide-y divide-border bg-card shadow-sm">
          {filtered.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

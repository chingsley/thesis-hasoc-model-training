import { useState } from 'react'
import type { Post, TriageStatus } from '@/lib/types'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DatePickerField } from '@/components/ui/date-picker'
import type { RelabelMode } from './RelabelSheet'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from './post-cells'
import { useFlagPost, useUpdateTriageStatus } from '@/hooks/use-posts'
import { CheckCircle, Flag, FlagOff, Pencil, RotateCcw, Search, Tags, X } from 'lucide-react'

export type TriageBucket = 'pending' | 'cleared' | 'flagged' | 'relabelled'
export type TriageLabelFilter = 'all' | 'Hate' | 'Abuse'

interface TriageTableProps {
  bucket: TriageBucket
  posts: Post[]
  labelFilter: TriageLabelFilter
  onRelabel: (post: Post, mode: RelabelMode) => void
}

const manualLabelCell = (p: Post) =>
  p.manual_label ? (
    <PredictionCell label={p.manual_label} />
  ) : (
    <span className="text-muted-foreground">--</span>
  )

const BASE_COLUMNS: DataTableColumn<Post>[] = [
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
          <Badge variant="outline" className="border-destructive text-xs text-destructive">
            True: {p.label}
          </Badge>
        )}
      </div>
    ),
  },
  { id: 'hate', header: 'Hate probability', cell: (p) => <HateProbCell value={p.probabilities.hate} /> },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
]

const MAIN_COLUMNS: DataTableColumn<Post>[] = [
  ...BASE_COLUMNS.slice(0, 3),
  { id: 'manual', header: 'Manual label', cell: manualLabelCell },
  ...BASE_COLUMNS.slice(3),
]

const RELABEL_COLUMNS: DataTableColumn<Post>[] = [
  { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} /> },
  {
    id: 'post',
    header: 'Post',
    className: 'max-w-[28rem] whitespace-normal',
    cell: (p) => <PostTextCell text={p.tweet} />,
  },
  { id: 'machine', header: 'Prediction', cell: (p) => <PredictionCell label={p.predicted_label} /> },
  { id: 'manual', header: 'Manual label', cell: manualLabelCell },
  { id: 'hate', header: 'Hate probability', cell: (p) => <HateProbCell value={p.probabilities.hate} /> },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
]

const COLUMNS_BY_BUCKET: Record<TriageBucket, DataTableColumn<Post>[]> = {
  pending: MAIN_COLUMNS,
  cleared: MAIN_COLUMNS,
  flagged: MAIN_COLUMNS,
  relabelled: RELABEL_COLUMNS,
}

const EMPTY_TEXT: Record<TriageBucket, string> = {
  pending: 'No pending posts — all caught up',
  cleared: 'No cleared posts yet',
  flagged: 'No flagged posts yet',
  relabelled: 'No relabelled posts — use Relabel on a pending post you disagree with',
}

export function TriageTable({ bucket, posts, labelFilter, onRelabel }: TriageTableProps) {
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minHate, setMinHate] = useState('')
  const [maxHate, setMaxHate] = useState('')
  const flagMutation = useFlagPost()
  const statusMutation = useUpdateTriageStatus()

  const minProb = minHate === '' ? null : Number(minHate) / 100
  const maxProb = maxHate === '' ? null : Number(maxHate) / 100

  const filtered = posts.filter((p) => {
    if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false
    if (search && !p.tweet.toLowerCase().includes(search.toLowerCase()) && !p.id.includes(search))
      return false
    const day = (p.timestamp || '').split('T')[0]
    if (startDate && day && day < startDate) return false
    if (endDate && day && day > endDate) return false
    if (minProb !== null && !Number.isNaN(minProb) && p.probabilities.hate < minProb) return false
    if (maxProb !== null && !Number.isNaN(maxProb) && p.probabilities.hate > maxProb) return false
    return true
  })

  const hasFilters =
    Boolean(search) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(minHate) ||
    Boolean(maxHate)

  const clearFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setMinHate('')
    setMaxHate('')
  }

  const busy =
    (flagMutation.isPending && flagMutation.variables) ||
    (statusMutation.isPending && statusMutation.variables?.postId) ||
    null

  const setStatus = (postId: string, status: TriageStatus) =>
    statusMutation.mutate({ postId, status })

  const rowActions = (post: Post) => {
    const disabled = busy === post.id
    switch (bucket) {
      case 'pending':
        return (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => flagMutation.mutate(post.id)}
            >
              <Flag className="h-3 w-3" /> Flag
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => setStatus(post.id, 'cleared')}
            >
              <CheckCircle className="h-3 w-3" /> Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              title="Relabel (correct the model's label)"
              disabled={disabled}
              onClick={() => onRelabel(post, 'create')}
            >
              <Tags className="h-3 w-3" /> Relabel
            </Button>
          </>
        )
      case 'cleared':
        return (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => setStatus(post.id, 'pending')}
            >
              <RotateCcw className="h-3 w-3" /> Reopen
            </Button>
          </>
        )
      case 'flagged':
        return (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => setStatus(post.id, 'pending')}
            >
              <FlagOff className="h-3 w-3" /> Unflag
            </Button>
          </>
        )
      case 'relabelled':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onRelabel(post, 'edit')}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          </>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative min-w-0 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--hg-subtle)]" />
          <Input
            placeholder="Search posts or IDs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-[4px] border-[var(--hg-border)] bg-[var(--hg-canvas)] pl-9 text-sm shadow-none focus-visible:border-[var(--hg-brand)] focus-visible:bg-white"
            aria-label="Search posts"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-[var(--hg-border)] pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <DatePickerField
              label="From"
              value={startDate}
              max={endDate || undefined}
              rangeMate={endDate}
              rangeRole="start"
              clearable
              onChange={setStartDate}
            />
            <DatePickerField
              label="To"
              value={endDate}
              min={startDate || undefined}
              rangeMate={startDate}
              rangeRole="end"
              clearable
              onChange={setEndDate}
            />
          </div>

          <span aria-hidden className="hidden h-4 w-px bg-[var(--hg-border)] sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-[var(--hg-muted)] uppercase">
              Hate %
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--hg-border)] bg-white px-2 py-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="0"
                value={minHate}
                onChange={(e) => setMinHate(e.target.value)}
                className="h-6 w-12 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label="Minimum hate probability percent"
              />
              <span className="text-[var(--hg-subtle)]">–</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="100"
                value={maxHate}
                onChange={(e) => setMaxHate(e.target.value)}
                className="h-6 w-12 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                aria-label="Maximum hate probability percent"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <p className="text-xs tabular-nums text-[var(--hg-muted)]">
              {filtered.length === posts.length
                ? `${filtered.length.toLocaleString()} posts`
                : `${filtered.length.toLocaleString()} of ${posts.length.toLocaleString()}`}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--hg-muted)] transition-colors hover:text-[var(--hg-ink)]"
              >
                <X className="size-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        columns={COLUMNS_BY_BUCKET[bucket]}
        data={filtered}
        getRowId={(p) => p.id}
        maxHeight="520px"
        empty={
          <div className="py-12 text-center text-muted-foreground">
            <p>{EMPTY_TEXT[bucket]}</p>
          </div>
        }
        actions={rowActions}
      />
    </div>
  )
}

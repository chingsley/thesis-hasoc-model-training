import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { fetchPosts } from '@/lib/api/client'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import { useUpdateTriageStatus } from '@/hooks/use-posts'
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from '@/components/dashboard/post-cells'
import type { Post } from '@/lib/types'
import { Download, FileText as FileTextIcon, Loader2, Search, Trash2 } from 'lucide-react'

type LabelFilter = 'all' | 'Hate' | 'Abuse'

const CSV_HEADER = 'id,tweet,label,predicted_label,hate_probability,flagged,reported_date'

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
    id: 'hate',
    header: 'Hate probability',
    cell: (p) => <HateProbCell value={p.probabilities.hate} />,
  },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
]

function toCsvRow(p: Post): string {
  const date = (p.timestamp || '').split('T')[0]
  return `${p.id},"${p.tweet.replace(/"/g, '""')}",${p.label},${p.predicted_label},${p.probabilities.hate.toFixed(3)},${p.flagged},${date}`
}

export function ExportReport() {
  const language = useDashboardStore((s) => s.language)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')
  const [exporting, setExporting] = useState(false)
  const removeMutation = useUpdateTriageStatus()

  const { data: posts, isLoading } = useQuery({
    queryKey: ['reported-posts', language],
    queryFn: () => fetchPosts(language, 5000),
  })

  // The incident report = the caller's predictions marked triage_status "reported",
  // within the selected processing-date range, matching the label pill and search text.
  const reportedInRange = useMemo(() => {
    return (posts ?? []).filter((p) => {
      if (p.triage_status !== 'reported') return false
      const day = (p.timestamp || '').split('T')[0]
      if (startDate && day && day < startDate) return false
      if (endDate && day && day > endDate) return false
      return true
    })
  }, [posts, startDate, endDate])

  const filtered = useMemo(() => {
    return reportedInRange.filter((p) => {
      if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.tweet.toLowerCase().includes(q) && !p.id.includes(q)) return false
      }
      return true
    })
  }, [reportedInRange, labelFilter, search])

  const pillCounts: Record<LabelFilter, number> = {
    all: reportedInRange.length,
    Hate: reportedInRange.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: reportedInRange.filter((p) => p.predicted_label === 'Abuse').length,
  }

  const hateCount = filtered.filter((p) => p.predicted_label === 'Hate').length
  const abuseCount = filtered.filter((p) => p.predicted_label === 'Abuse').length

  const handleExportCSV = () => {
    setExporting(true)
    try {
      const csv = [CSV_HEADER, ...filtered.map(toCsvRow)].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incident_report_${language}_${startDate}_${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle>
          <span className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Incident Report
          </span>
        </SectionTitle>
        <CardDescription>
          Posts you flagged as reported (Triage Queue), filtered by processing date. Export
          downloads exactly the rows shown below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'Hate', 'Abuse'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={labelFilter === f ? 'default' : 'outline'}
                onClick={() => setLabelFilter(f)}
              >
                {f === 'all' ? 'All' : f} ({pillCounts[f]})
              </Button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search text or post id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Reported Posts</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-destructive">{hateCount}</p>
            <p className="text-xs text-muted-foreground">Hateful</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-amber-600">{abuseCount}</p>
            <p className="text-xs text-muted-foreground">Abusive</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable
            columns={COLUMNS}
            data={filtered}
            getRowId={(p) => p.id}
            maxHeight="420px"
            empty={
              <div className="text-center py-8 text-muted-foreground">
                <p>No reported posts in this range</p>
                <p className="text-xs mt-1">
                  Flag posts in the Triage Queue to add them to your incident report.
                </p>
              </div>
            }
            actions={(p) => (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                title="Remove from report"
                aria-label={`Remove ${p.id} from report`}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate({ postId: p.id, status: 'new' })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        )}

        <Button
          onClick={handleExportCSV}
          disabled={exporting || filtered.length === 0}
          className="w-full sm:w-auto"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSV ({filtered.length} {filtered.length === 1 ? 'row' : 'rows'})
        </Button>
      </CardContent>
    </Card>
  )
}

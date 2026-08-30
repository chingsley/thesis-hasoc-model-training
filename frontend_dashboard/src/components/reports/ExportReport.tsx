import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { fetchPosts } from '@/lib/api/client';
import { SectionTitle } from '@/components/ui/data-source-badge';
import { useDashboardStore } from '@/lib/store/dashboard';
import { useUpdateTriageStatus } from '@/hooks/use-posts';
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from '@/components/dashboard/post-cells';
import type { Post } from '@/lib/types';
import { Download, FileText as FileTextIcon, Loader2, Search, FlagOff } from 'lucide-react';

type LabelFilter = 'all' | 'Hate' | 'Abuse';

const CSV_HEADER = 'id,tweet,label,predicted_label,hate_probability,flagged,reported_date';

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
];

function toCsvRow(p: Post): string {
  const date = (p.timestamp || '').split('T')[0];
  return `${p.id},"${p.tweet.replace(/"/g, '""')}",${p.label},${p.predicted_label},${p.probabilities.hate.toFixed(3)},${p.flagged},${date}`;
}

export function ExportReport() {
  const language = useDashboardStore((s) => s.language);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [minHate, setMinHate] = useState('');
  const [maxHate, setMaxHate] = useState('');
  const [exporting, setExporting] = useState(false);
  const removeMutation = useUpdateTriageStatus();

  const { data: posts, isLoading } = useQuery({
    queryKey: ['reported-posts', language],
    queryFn: () => fetchPosts(language, 5000),
  });

  // The incident report mirrors the Triage "flagged" bucket: the caller's predictions
  // with triage_status "flagged", in the date range, matching the label pill and search.
  const reportedInRange = useMemo(() => {
    return (posts ?? []).filter((p) => {
      if (p.triage_status !== 'flagged') return false;
      const day = (p.timestamp || '').split('T')[0];
      if (startDate && day && day < startDate) return false;
      if (endDate && day && day > endDate) return false;
      return true;
    });
  }, [posts, startDate, endDate]);

  const filtered = useMemo(() => {
    const min = minHate === '' ? null : Number(minHate) / 100;
    const max = maxHate === '' ? null : Number(maxHate) / 100;
    return reportedInRange.filter((p) => {
      if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false;
      if (min !== null && !Number.isNaN(min) && p.probabilities.hate < min) return false;
      if (max !== null && !Number.isNaN(max) && p.probabilities.hate > max) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.tweet.toLowerCase().includes(q) && !p.id.includes(q)) return false;
      }
      return true;
    });
  }, [reportedInRange, labelFilter, search, minHate, maxHate]);

  const pillCounts: Record<LabelFilter, number> = {
    all: reportedInRange.length,
    Hate: reportedInRange.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: reportedInRange.filter((p) => p.predicted_label === 'Abuse').length,
  };

  const hateCount = filtered.filter((p) => p.predicted_label === 'Hate').length;
  const abuseCount = filtered.filter((p) => p.predicted_label === 'Abuse').length;

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const csv = [CSV_HEADER, ...filtered.map(toCsvRow)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incident_report_${language}_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

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
          Mirrors the Flagged bucket in Triage — posts you flagged, filtered by processing date.
          Unflag a row to send it back to Pending; both views stay in sync. Export downloads
          exactly the rows shown below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-[var(--hg-secondary)]">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Flagged Posts</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-amber-600">{abuseCount}</p>
            <p className="text-xs text-muted-foreground">Abusive</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <p className="text-2xl font-bold text-destructive">{hateCount}</p>
            <p className="text-xs text-muted-foreground">Hateful</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 mt-6">
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search text or post id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2 w-fit">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[11rem]"
            />
          </div>
          <div className="space-y-2 w-fit">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[11rem]"
            />
          </div>
          <div className="space-y-2 w-fit">
            <Label>Hate Probability range</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="Min"
                value={minHate}
                onChange={(e) => setMinHate(e.target.value)}
                className="w-20"
                aria-label="Minimum hate probability percent"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="Max"
                value={maxHate}
                onChange={(e) => setMaxHate(e.target.value)}
                className="w-20"
                aria-label="Maximum hate probability percent"
              />
            </div>
          </div>
          <div className="flex gap-1 ml-auto">
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
                <p>No flagged posts in this range</p>
                <p className="text-xs mt-1">
                  Flag posts in the Triage Queue (Pending bucket) to add them to your incident report.
                </p>
              </div>
            }
            actions={(p) => (
              <Button
                variant="secondary"
                size="sm"
                title="Unflag — returns the post to the Pending queue in Triage"
                aria-label={`Unflag ${p.id}`}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate({ postId: p.id, status: 'pending' })}
              >
                <FlagOff className="h-3 w-3" /> Unflag
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
  );
}

import { useState } from 'react';
import type { Post, TriageStatus } from '@/lib/types';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RelabelMode } from './RelabelSheet';
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from './post-cells';
import { useFlagPost, useUpdateTriageStatus } from '@/hooks/use-posts';
import { useDashboardStore } from '@/lib/store/dashboard';
import { CheckCircle, Download, Flag, FlagOff, Pencil, RotateCcw, Search, Tags } from 'lucide-react';

const CSV_HEADER = 'id,tweet,label,predicted_label,hate_probability,flagged,manual_label,reported_date';

function toCsvRow(p: Post): string {
  const date = (p.timestamp || '').split('T')[0];
  return `${p.id},"${p.tweet.replace(/"/g, '""')}",${p.label},${p.predicted_label},${p.probabilities.hate.toFixed(3)},${p.flagged},${p.manual_label ?? ''},${date}`;
}

export type TriageBucket = 'pending' | 'cleared' | 'flagged' | 'relabelled';

interface TriageTableProps {
  bucket: TriageBucket;
  posts: Post[];
  onRelabel: (post: Post, mode: RelabelMode) => void;
}

const BUCKET_TITLES: Record<TriageBucket, string> = {
  pending: 'Pending Reviews',
  cleared: 'Cleared Posts',
  flagged: 'Flagged Posts',
  relabelled: 'Relabelled Posts',
};

const manualLabelCell = (p: Post) =>
  p.manual_label ? (
    <PredictionCell label={p.manual_label} />
  ) : (
    <span className="text-muted-foreground">--</span>
  );

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
          <Badge variant="outline" className="text-xs border-destructive text-destructive">
            True: {p.label}
          </Badge>
        )}
      </div>
    ),
  },
  { id: 'hate', header: 'Hate probability', cell: (p) => <HateProbCell value={p.probabilities.hate} /> },
  { id: 'date', header: 'Date', cell: (p) => <DateCell timestamp={p.timestamp} /> },
];

// Pending/cleared/flagged share one column set, with the reviewer's manual label (if any).
const MAIN_COLUMNS: DataTableColumn<Post>[] = [
  ...BASE_COLUMNS.slice(0, 3),
  { id: 'manual', header: 'Manual label', cell: manualLabelCell },
  ...BASE_COLUMNS.slice(3),
];

// Relabelled bucket: prediction vs manual label columns (no status).
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
];

const COLUMNS_BY_BUCKET: Record<TriageBucket, DataTableColumn<Post>[]> = {
  pending: MAIN_COLUMNS,
  cleared: MAIN_COLUMNS,
  flagged: MAIN_COLUMNS,
  relabelled: RELABEL_COLUMNS,
};

const EMPTY_TEXT: Record<TriageBucket, string> = {
  pending: 'No pending posts — all caught up',
  cleared: 'No cleared posts yet',
  flagged: 'No flagged posts yet',
  relabelled: 'No relabelled posts — use Relabel on a pending post you disagree with',
};

export function TriageTable({ bucket, posts, onRelabel }: TriageTableProps) {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minHate, setMinHate] = useState('');
  const [maxHate, setMaxHate] = useState('');
  const [labelFilter, setLabelFilter] = useState<'all' | 'Hate' | 'Abuse'>('all');
  const [exporting, setExporting] = useState(false);
  const language = useDashboardStore((s) => s.language);
  const flagMutation = useFlagPost();
  const statusMutation = useUpdateTriageStatus();

  const minProb = minHate === '' ? null : Number(minHate) / 100;
  const maxProb = maxHate === '' ? null : Number(maxHate) / 100;

  const pillCounts = {
    all: posts.length,
    Hate: posts.filter((p) => p.predicted_label === 'Hate').length,
    Abuse: posts.filter((p) => p.predicted_label === 'Abuse').length,
  };

  const filtered = posts.filter((p) => {
    if (labelFilter !== 'all' && p.predicted_label !== labelFilter) return false;
    if (search && !p.tweet.toLowerCase().includes(search.toLowerCase()) && !p.id.includes(search))
      return false;
    const day = (p.timestamp || '').split('T')[0];
    if (startDate && day && day < startDate) return false;
    if (endDate && day && day > endDate) return false;
    if (minProb !== null && !Number.isNaN(minProb) && p.probabilities.hate < minProb) return false;
    if (maxProb !== null && !Number.isNaN(maxProb) && p.probabilities.hate > maxProb) return false;
    return true;
  });

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
      a.download = `triage_${bucket}_${language}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const busy =
    (flagMutation.isPending && flagMutation.variables) ||
    (statusMutation.isPending && statusMutation.variables?.postId) ||
    null;

  const setStatus = (postId: string, status: TriageStatus) =>
    statusMutation.mutate({ postId, status });

  const rowActions = (post: Post) => {
    const disabled = busy === post.id;
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
        );
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
        );
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
        );
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
        );
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{BUCKET_TITLES[bucket]}</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-muted rounded-lg text-center">
          <p className="text-2xl font-bold text-primary">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">{BUCKET_TITLES[bucket]}</p>
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

      <div className="flex flex-wrap items-end gap-3 mt-16">
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

      <DataTable
        columns={COLUMNS_BY_BUCKET[bucket]}
        data={filtered}
        getRowId={(p) => p.id}
        maxHeight="520px"
        empty={
          <div className="text-center py-12 text-muted-foreground">
            <p>{EMPTY_TEXT[bucket]}</p>
          </div>
        }
        actions={rowActions}
      />

      <Button
        onClick={handleExportCSV}
        disabled={exporting || filtered.length === 0}
        className="w-full sm:w-auto"
      >
        <Download className="h-4 w-4 mr-2" />
        Export CSV ({filtered.length} {filtered.length === 1 ? 'row' : 'rows'})
      </Button>
    </div>
  );
}

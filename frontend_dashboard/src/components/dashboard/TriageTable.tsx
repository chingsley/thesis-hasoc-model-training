import { useState } from 'react';
import type { Post, TriageBucket, TriageStatus } from '@/lib/types';
import { TablePagination } from '@/components/ui/table-pagination';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { PostQueryToolbar } from '@/components/dashboard/PostQueryToolbar';
import type { RelabelMode } from './RelabelSheet';
import { DateCell, HateProbCell, PostIdCell, PostTextCell, PredictionCell } from './post-cells';
import { modelPrediction, reviewerLabel } from '@/lib/post-labels';
import { REVIEW_AND_REPORT_TITLE } from '@/lib/module-names';
import { bucketCountForLabelFilter, formatTabCount } from '@/lib/triage-buckets';
import type { TriageStatsData } from '@/lib/types';
import { useFlagPost, useUpdateTriageStatus } from '@/hooks/use-posts';
import { fetchAllTriagePostsMatching, type TriagePostsQuery } from '@/lib/api/client';
import { useDashboardStore } from '@/lib/store/dashboard';
import { cn } from '@/lib/utils';
import { Download, Flag, FlagOff, Pencil, Tags, Loader2 } from 'lucide-react';

const CSV_HEADER =
  'id,tweet,model_prediction,reviewer_label,hate_probability,triage_status,flagged,reported_date';

function toCsvRow(p: Post): string {
  const date = (p.timestamp || '').split('T')[0];
  return [
    p.id,
    `"${p.tweet.replace(/"/g, '""')}"`,
    modelPrediction(p),
    reviewerLabel(p) ?? '',
    p.probabilities.hate.toFixed(3),
    p.triage_status,
    String(p.flagged),
    date,
  ].join(',');
}

export type { TriageBucket } from '@/lib/types';
export type TriageLabelFilter = 'all' | 'Normal' | 'Hate' | 'Abuse';

const SEGMENT_GROUP_CLASS =
  'inline-flex w-fit shrink-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5';

const BUCKET_TABS: { value: TriageBucket; label: string; }[] = [
  { value: 'pending', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'relabelled', label: 'Relabelled' },
];

const LABEL_FILTERS: { id: TriageLabelFilter; label: string; }[] = [
  { id: 'all', label: 'All' },
  { id: 'Normal', label: 'Normal' },
  { id: 'Abuse', label: 'Abuse' },
  { id: 'Hate', label: 'Hate' },
];

export function TriageBucketFilter({
  value,
  onChange,
  bucketCounts,
  labelFilter,
}: {
  value: TriageBucket;
  onChange: (bucket: TriageBucket) => void;
  bucketCounts?: TriageStatsData;
  labelFilter: TriageLabelFilter;
}) {
  return (
    <div className={SEGMENT_GROUP_CLASS} role="tablist" aria-label={`${REVIEW_AND_REPORT_TITLE} bucket`}>
      {BUCKET_TABS.map((tab) => {
        const active = value === tab.value;
        const n = bucketCountForLabelFilter(bucketCounts?.[tab.value], labelFilter);
        const countLabel = n === undefined ? null : formatTabCount(n);
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'group inline-flex items-center rounded-[4px] px-2.5 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
            )}
          >
            {tab.label}
            {countLabel != null && (
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  active ? 'text-[var(--hg-brand)]' : 'text-[var(--hg-subtle)]',
                )}
              >
                {countLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TriagePredictionLabelFilter({
  labelFilter,
  onLabelFilterChange,
  layout = 'inline',
  size = 'default',
  className,
}: {
  labelFilter: TriageLabelFilter;
  onLabelFilterChange: (filter: TriageLabelFilter) => void;
  /** `fullWidth` — equal-width segments for narrow side panels. */
  layout?: 'inline' | 'fullWidth';
  /** `comfortable` — 40px control height (matches sidebar nav rows). */
  size?: 'default' | 'comfortable';
  className?: string;
}) {
  return (
    <div
      className={cn(
        SEGMENT_GROUP_CLASS,
        layout === 'fullWidth' && 'flex w-full min-w-0',
        size === 'comfortable' && 'h-10 items-stretch',
        className,
      )}
      role="group"
      aria-label="Filter by prediction"
    >
      {LABEL_FILTERS.map((f) => {
        const active = labelFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={active}
            onClick={() => onLabelFilterChange(f.id)}
            className={cn(
              'inline-flex items-center rounded-[4px] font-medium transition-colors',
              size === 'comfortable' ? 'text-sm' : 'py-1.5 text-xs',
              layout === 'fullWidth' ? 'min-w-0 flex-1 justify-center px-1' : 'px-2.5',
              size === 'comfortable' && 'h-full min-h-0',
              active
                ? 'bg-white text-[var(--hg-ink)] shadow-sm'
                : 'text-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-black',
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

interface TriageTableProps {
  bucket: TriageBucket;
  posts: Post[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onBucketChange: (bucket: TriageBucket) => void;
  search: string;
  onSearchChange: (value: string) => void;
  startDate: string;
  endDate: string;
  minHate: string;
  maxHate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMinHateChange: (value: string) => void;
  onMaxHateChange: (value: string) => void;
  loading?: boolean;
  fetching?: boolean;
  onRelabel: (post: Post, mode: RelabelMode) => void;
  bucketCounts?: TriageStatsData;
  labelFilter: TriageLabelFilter;
  exportQuery: Omit<TriagePostsQuery, 'language' | 'limit' | 'offset'>;
}

function relabelModeForBucket(bucket: TriageBucket): RelabelMode {
  return bucket === 'relabelled' ? 'edit' : 'create';
}

function buildColumns(
  onRelabel: (post: Post, mode: RelabelMode) => void,
  bucket: TriageBucket,
): DataTableColumn<Post>[] {
  return [
    { id: 'id', header: 'Post ID', cell: (p) => <PostIdCell id={p.id} />, className: 'whitespace-nowrap' },
    {
      id: 'post',
      header: 'Post',
      className: 'max-w-[28rem] whitespace-normal',
      cell: (p) => (
        <PostTextCell
          text={p.tweet}
          maxWords={20}
          onClick={() => onRelabel(p, relabelModeForBucket(bucket))}
        />
      ),
    },
    {
      id: 'prediction',
      header: 'Prediction',
      className: 'whitespace-nowrap',
      cell: (p) => <PredictionCell label={modelPrediction(p)} />,
    },
    {
      id: 'reviewer_label',
      header: 'Reviewer label',
      className: 'whitespace-nowrap',
      cell: (p) => {
        const label = reviewerLabel(p);
        return label ? (
          <PredictionCell label={label} />
        ) : (
          <span className="text-[var(--hg-subtle)]">—</span>
        );
      },
    },
    {
      id: 'hate',
      header: 'Hate %',
      className: 'whitespace-nowrap',
      cell: (p) => <HateProbCell value={p.probabilities.hate} />,
    },
    {
      id: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      cell: (p) => <DateCell timestamp={p.timestamp} />,
    },
  ];
}

const EMPTY_TEXT: Record<TriageBucket, string> = {
  pending: 'No posts in the queue yet',
  flagged: 'No flagged posts yet',
  relabelled: 'No relabelled posts — use View/Relabel on a post you disagree with',
};

export function TriageTable({
  bucket,
  posts,
  total,
  page,
  pageSize,
  onPageChange,
  onBucketChange,
  search,
  onSearchChange,
  startDate,
  endDate,
  minHate,
  maxHate,
  onStartDateChange,
  onEndDateChange,
  onMinHateChange,
  onMaxHateChange,
  loading,
  fetching,
  onRelabel,
  bucketCounts,
  labelFilter,
  exportQuery,
}: TriageTableProps) {
  const columns = buildColumns(onRelabel, bucket);
  const [exporting, setExporting] = useState(false);
  const language = useDashboardStore((s) => s.language);
  const flagMutation = useFlagPost();
  const statusMutation = useUpdateTriageStatus();

  const handleExportCsv = async () => {
    if (total === 0 || exporting) return;
    setExporting(true);
    try {
      const rows = await fetchAllTriagePostsMatching({ ...exportQuery, language });
      const csv = [CSV_HEADER, ...rows.map(toCsvRow)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `review_report_${bucket}_${language}_${new Date().toISOString().slice(0, 10)}.csv`;
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
    const actionClass =
      'h-7 rounded-[4px] border border-[var(--hg-border)] bg-white px-2 text-xs font-medium text-[var(--hg-muted)] shadow-none hover:border-[var(--hg-muted)] hover:bg-[var(--hg-soft)] hover:text-[var(--hg-ink)]';
    const unflagIconClass = 'size-3.5 shrink-0 text-[var(--hg-matrix-error)]';
    const flagIconClass = 'size-3.5 shrink-0 text-current';
    switch (bucket) {
      case 'pending':
        return (
          <>
            {post.triage_status === 'flagged' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                className={actionClass}
                onClick={() => setStatus(post.id, 'pending')}
              >
                <FlagOff className={unflagIconClass} aria-hidden />
                Unflag
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                className={actionClass}
                onClick={() => flagMutation.mutate(post.id)}
              >
                <Flag className={flagIconClass} aria-hidden />
                Flag
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              title="Relabel (correct the model's label)"
              disabled={disabled}
              className={actionClass}
              onClick={() => onRelabel(post, 'create')}
            >
              <Tags className="size-3.5" /> View/Relabel
            </Button>
          </>
        );
      case 'flagged':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              className={actionClass}
              onClick={() => setStatus(post.id, 'pending')}
            >
              <FlagOff className={unflagIconClass} aria-hidden />
              Unflag
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
              className={actionClass}
              onClick={() => onRelabel(post, 'edit')}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          </>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <PostQueryToolbar
          search={search}
          onSearchChange={onSearchChange}
          startDate={startDate}
          endDate={endDate}
          minHate={minHate}
          maxHate={maxHate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onMinHateChange={onMinHateChange}
          onMaxHateChange={onMaxHateChange}
        />

        <div className="flex flex-wrap items-center gap-3">
          <TriageBucketFilter
            value={bucket}
            onChange={onBucketChange}
            bucketCounts={bucketCounts}
            labelFilter={labelFilter}
          />
          <Button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || total === 0}
            className={cn(
              'h-9 shrink-0 gap-1.5 rounded-[4px] bg-[var(--hg-accent-surface)] px-3 text-sm text-white hover:bg-[var(--hg-accent-surface-hover)]',
              total >= 1000 && 'w-[178px] justify-center',
            )}
            title="Export all rows matching current filters"
            aria-label={`Export CSV (${total.toLocaleString()} rows matching current filters)`}
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            Export CSV
            <span className="tabular-nums text-white/90">({formatTabCount(total)})</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-[4px] border border-dashed border-[var(--hg-border)] bg-[var(--hg-canvas)]/50">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--hg-subtle)]" />
        </div>
      ) : (
        <>
          <div className={cn(fetching && 'opacity-60 transition-opacity')}>
            <DataTable
              columns={columns}
              data={posts}
              getRowId={(p) => p.id}
              maxHeight="520px"
              caption={`${bucket} ${REVIEW_AND_REPORT_TITLE} posts`}
              empty={
                <div className="text-center text-[var(--hg-muted)]">
                  <p className="text-sm font-medium text-[var(--hg-ink)]">{EMPTY_TEXT[bucket]}</p>
                </div>
              }
              actions={rowActions}
            />
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}

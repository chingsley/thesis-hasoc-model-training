import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HateProbCell, PostIdCell, PredictionCell } from '@/components/dashboard/post-cells'
import { useDashboardStore } from '@/lib/store/dashboard'
import { batchClassify } from '@/lib/api/client'
import type { BatchResult } from '@/lib/types'
import { cn } from '@/lib/utils'

export function BatchScanner() {
  const language = useDashboardStore((s) => s.language)
  const languageLabel = language === 'igbo' ? 'Igbo' : 'Yoruba'
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (texts: string[]) => batchClassify(texts, language),
    onSuccess: (data) => {
      setResults(data)
      queryClient.invalidateQueries({ queryKey: ['overview-stats'] })
      queryClient.invalidateQueries({ queryKey: ['volume'] })
    },
  })

  const counts = useMemo(() => {
    if (!results) return null
    return {
      total: results.length,
      normal: results.filter((r) => r.predicted_label === 'Normal').length,
      abuse: results.filter((r) => r.predicted_label === 'Abuse').length,
      hate: results.filter((r) => r.predicted_label === 'Hate').length,
    }
  }, [results])

  const parseAndRun = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const csv = ev.target?.result as string
      const lines = csv.split('\n').filter(Boolean)
      const texts = lines
        .map((line) => {
          const cols = line.split(',')
          return cols[cols.length - 1]?.trim().replace(/^"|"$/g, '') ?? line.trim()
        })
        .filter((t) => t.length > 0)
      if (texts.length > 0) mutation.mutate(texts)
    }
    reader.readAsText(f)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseAndRun(f)
    e.target.value = ''
  }

  const handleDownload = () => {
    if (!results) return
    const header = 'id,tweet,predicted_label,normal_prob,abuse_prob,hate_prob'
    const rows = results.map(
      (r) =>
        `${r.id},"${r.tweet.replace(/"/g, '""')}",${r.predicted_label},${r.probabilities.normal.toFixed(3)},${r.probabilities.abuse.toFixed(3)},${r.probabilities.hate.toFixed(3)}`,
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch_results_${language}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      <div
        className={cn(
          'rounded-[4px] border border-dashed px-4 py-8 text-center transition-colors',
          dragging
            ? 'border-[var(--hg-brand)] bg-[var(--hg-soft)]/40'
            : 'border-[var(--hg-border)] bg-[var(--hg-canvas)]/40',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) parseAndRun(f)
        }}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[4px] bg-white ring-1 ring-[var(--hg-border)]">
            <Upload className="size-4 text-[var(--hg-brand)]" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--hg-ink)]">
              Upload a CSV or text file
            </p>
            <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
              One message per line (or last CSV column). Classified as {languageLabel}.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[4px] bg-[var(--hg-brand)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--hg-brand)]/90">
              <Upload className="size-3.5" aria-hidden />
              Choose file
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {results && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                className="h-8 rounded-[4px] border-[var(--hg-border)]"
              >
                <Download className="size-3.5" aria-hidden />
                Download results
              </Button>
            )}
          </div>
          {file && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--hg-muted)]">
              <FileText className="size-3" aria-hidden />
              {file.name}
            </p>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div className="rounded-[4px] border border-[var(--hg-secondary)]/25 bg-[var(--hg-secondary)]/5 px-4 py-3">
          <p className="text-sm font-medium text-[var(--hg-secondary)]">Batch classification failed</p>
          <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
            Check that the backend is running and reachable via the Vite proxy, then try again.
          </p>
        </div>
      )}

      {mutation.isPending && (
        <div className="flex items-center justify-center gap-3 py-12">
          <Loader2 className="size-5 animate-spin text-[var(--hg-subtle)]" />
          <p className="text-sm text-[var(--hg-muted)]">Classifying batch…</p>
        </div>
      )}

      {counts && !mutation.isPending && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--hg-border)] pb-3">
            {[
              { label: 'Texts', value: String(counts.total), hint: 'Classified in this run' },
              { label: 'Normal', value: String(counts.normal), hint: 'Safe / non-toxic' },
              { label: 'Abuse', value: String(counts.abuse), hint: 'Offensive / abusive' },
              { label: 'Hate', value: String(counts.hate), hint: 'Hate speech' },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] font-medium tracking-wide text-[var(--hg-subtle)] uppercase">
                  {item.label}
                </p>
                <p className="text-sm font-semibold tabular-nums text-[var(--hg-ink)]">{item.value}</p>
                <p className="truncate text-[10px] text-[var(--hg-muted)]">{item.hint}</p>
              </div>
            ))}
          </div>

          <ul className="max-h-[420px] space-y-1.5 overflow-auto">
            {results!.map((r) => (
              <li
                key={r.id}
                className="rounded-[4px] border border-[var(--hg-border)] bg-white px-3 py-2.5"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <PredictionCell label={r.predicted_label} />
                  <PostIdCell id={r.id} />
                  <div className="ml-auto">
                    <HateProbCell value={r.probabilities.hate} />
                  </div>
                </div>
                <p className="line-clamp-2 text-sm leading-snug text-[var(--hg-ink)]" title={r.tweet}>
                  {r.tweet}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!results && !mutation.isPending && !mutation.isError && (
        <p className="text-center text-[11px] text-[var(--hg-muted)]">
          Drop a file above to classify many messages in one run.
        </p>
      )}
    </div>
  )
}

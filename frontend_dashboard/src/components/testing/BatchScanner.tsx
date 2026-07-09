import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDashboardStore } from '@/lib/store/dashboard'
import { batchClassify } from '@/lib/api/client'
import type { BatchResult } from '@/lib/types'
import { Loader2, Upload, Download, FileText } from 'lucide-react'

export function BatchScanner() {
  const language = useDashboardStore((s) => s.language)
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: (texts: string[]) => batchClassify(texts, language),
    onSuccess: (data) => setResults(data),
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
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
      if (texts.length > 0) {
        mutation.mutate(texts)
      }
    }
    reader.readAsText(f)
  }

  const handleDownload = () => {
    if (!results) return
    const header = 'id,tweet,predicted_label,normal_prob,abuse_prob,hate_prob'
    const rows = results.map(
      (r) =>
        `${r.id},"${r.tweet.replace(/"/g, '""')}",${r.predicted_label},${r.probabilities.normal.toFixed(3)},${r.probabilities.abuse.toFixed(3)},${r.probabilities.hate.toFixed(3)}`
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

  const getLabelVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium transition-colors">
            <Upload className="h-4 w-4" />
            Upload CSV
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        {file && <span className="text-sm text-muted-foreground"><FileText className="h-3 w-3 inline mr-1" />{file.name}</span>}
        {results && (
        <Button variant="outline" onClick={handleDownload} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Results
          </Button>
        )}
      </div>

      {mutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Classifying batch...</span>
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Results ({results.length} texts)
            </h4>
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">
                Normal: {results.filter((r) => r.predicted_label === 'Normal').length}
              </Badge>
              <Badge variant="default">
                Abuse: {results.filter((r) => r.predicted_label === 'Abuse').length}
              </Badge>
              <Badge variant="destructive">
                Hate: {results.filter((r) => r.predicted_label === 'Hate').length}
              </Badge>
            </div>
          </div>
          <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-auto">
            {results.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <Badge variant={getLabelVariant(r.predicted_label)} className="shrink-0">
                  {r.predicted_label}
                </Badge>
                <p className="text-sm line-clamp-1 flex-1">{r.tweet}</p>
                <div className="flex gap-2 text-xs text-muted-foreground shrink-0">
                  <span>N:{(r.probabilities.normal * 100).toFixed(0)}%</span>
                  <span>A:{(r.probabilities.abuse * 100).toFixed(0)}%</span>
                  <span>H:{(r.probabilities.hate * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useRef } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard'
import { batchClassify } from '@/lib/api/client'
import type { BatchResult } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, Loader2 } from 'lucide-react'

export function BatchScanner() {
  const language = useDashboardStore((s) => s.language)
  const fileRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<BatchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')

  const parseCSV = (content: string): string[] => {
    const lines = content.trim().split('\n')
    const header = lines[0]?.toLowerCase() ?? ''
    const tweetIdx = header.includes('tweet') ? header.split(',').indexOf('tweet') : 0
    return lines
      .slice(header.includes('tweet') || header.includes('text') ? 1 : 0)
      .map((line) => {
        const cols = line.match(/(".*?"|[^,]+)/g) ?? [line]
        const val = cols[tweetIdx] ?? cols[0] ?? ''
        return val.replace(/^"|"$/g, '').trim()
      })
      .filter(Boolean)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setLoading(true)
    try {
      const content = await file.text()
      const texts = parseCSV(content)
      const classified = await batchClassify(texts, language)
      setResults(classified)
    } finally {
      setLoading(false)
    }
  }

  const downloadResults = () => {
    const header = 'id,tweet,predicted_label,prob_normal,prob_abuse,prob_hate'
    const rows = results.map(
      (r) =>
        `${r.id},"${r.tweet.replace(/"/g, '""')}",${r.predicted_label},${r.probabilities.normal.toFixed(3)},${r.probabilities.abuse.toFixed(3)},${r.probabilities.hate.toFixed(3)}`,
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch_results_${language}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const labelVariant = (label: string) => {
    if (label === 'Hate') return 'destructive' as const
    if (label === 'Abuse') return 'default' as const
    return 'secondary' as const
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle>Batch CSV Scanner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} />
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload CSV
          </Button>
          {results.length > 0 && (
            <Button onClick={downloadResults}>
              <Download className="h-4 w-4 mr-2" />
              Download Results
            </Button>
          )}
        </div>
        {fileName && <p className="text-sm text-muted-foreground">File: {fileName}</p>}

        {results.length > 0 && (
          <div className="border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Tweet</th>
                  <th className="p-2 text-left">Label</th>
                  <th className="p-2 text-right">Hate %</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 max-w-md truncate">{r.tweet}</td>
                    <td className="p-2">
                      <Badge variant={labelVariant(r.predicted_label)}>{r.predicted_label}</Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {(r.probabilities.hate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

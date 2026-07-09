import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getMockPosts } from '@/lib/api/mock'
import { useDashboardStore } from '@/lib/store/dashboard'
import { Download, FileText as FileTextIcon, Loader2 } from 'lucide-react'

export function ExportReport() {
  const language = useDashboardStore((s) => s.language)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)

  const handleExportCSV = () => {
    setExporting(true)
    setTimeout(() => {
      const posts = getMockPosts().filter((p) => {
        if (p.language !== language) return false
        if (p.triage_status !== 'reported') return false
        const ts = new Date(p.timestamp).getTime()
        const start = new Date(startDate).getTime()
        const end = new Date(endDate).getTime() + 86400000
        return ts >= start && ts <= end
      })

      const header = 'id,tweet,label,predicted_label,hate_probability,flagged,reported_date'
      const rows = posts.map(
        (p) =>
          `${p.id},"${p.tweet.replace(/"/g, '""')}",${p.label},${p.predicted_label},${p.probabilities.hate.toFixed(3)},${p.flagged},${new Date(p.timestamp).toISOString().split('T')[0]}`
      )
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `incident_report_${language}_${startDate}_${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setExporting(false)
    }, 500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="h-5 w-5" />
          Export Incident Report
        </CardTitle>
        <CardDescription>
          Generate a report of all flagged hate posts within a date range, ready to share with authorities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleExportCSV} disabled={exporting} className="w-full sm:w-auto">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export CSVs
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>The report includes:</p>
          <ul className="list-disc list-inside">
            <li>All flagged posts within the selected range</li>
            <li>Post text, predicted label, and confidence scores</li>
            <li>Hate probability for each post</li>
            <li>Flagging status and dates</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

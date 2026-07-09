import { useState } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard'
import { exportIncidentReport } from '@/lib/api/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, FileText, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export function ExportReport() {
  const language = useDashboardStore((s) => s.language)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(true)
    try {
      const rows = await exportIncidentReport(language, startDate, endDate)

      if (format === 'csv') {
        const header =
          'id,tweet,label,predicted_label,hate_probability,hate_target_category,toxic_highlights,flagged,reported_date'
        const csvRows = rows.map(
          (r) =>
            `${r.id},"${r.tweet.replace(/"/g, '""')}",${r.label},${r.predicted_label},${r.hate_probability.toFixed(3)},${r.hate_target_category},"${r.toxic_highlights.replace(/"/g, '""')}",${r.flagged},${r.reported_date}`,
        )
        const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `incident_report_${language}_${startDate}_${endDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const doc = new jsPDF()
        doc.setFontSize(16)
        doc.text('HateGuard Incident Report', 14, 20)
        doc.setFontSize(10)
        doc.text(`Language: ${language} | Period: ${startDate} to ${endDate}`, 14, 28)
        doc.text(`Total flagged posts: ${rows.length}`, 14, 34)

        autoTable(doc, {
          startY: 40,
          head: [['ID', 'Label', 'Hate %', 'Target', 'Highlights']],
          body: rows.map((r) => [
            r.id,
            r.predicted_label,
            `${(r.hate_probability * 100).toFixed(0)}%`,
            r.hate_target_category,
            r.toxic_highlights.slice(0, 40),
          ]),
          styles: { fontSize: 8 },
          columnStyles: { 4: { cellWidth: 60 } },
        })

        rows.slice(0, 10).forEach((r, i) => {
          const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 40
          if (finalY + 20 + i * 12 < 280) {
            doc.text(`${r.id}: ${r.tweet.slice(0, 80)}...`, 14, finalY + 10 + i * 12)
          }
        })

        doc.save(`incident_report_${language}_${startDate}_${endDate}.pdf`)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Export Incident Report
        </CardTitle>
        <CardDescription>
          Generate a report of flagged hate posts within a date range for authorities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => handleExport('csv')} disabled={exporting} variant="outline">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf')} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Export PDF
          </Button>
        </div>
        <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
          <li>Post text, predicted label, and confidence scores</li>
          <li>Hate target category and toxic token highlights</li>
          <li>Flagging status and report dates</li>
        </ul>
      </CardContent>
    </Card>
  )
}

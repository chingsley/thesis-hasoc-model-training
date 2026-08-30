import { BorderlineReview } from '@/components/reports/BorderlineReview'
import { ExportReport } from '@/components/reports/ExportReport'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Reports() {
  return (
    <div className="space-y-8">
      <SectionTitle description="Review uncertain predictions and export flagged posts for incident reporting.">
        Reports
      </SectionTitle>

      <Tabs defaultValue="borderline" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-[4px] border border-[var(--hg-border)] bg-white p-1 shadow-[var(--hg-shadow)]">
          <TabsTrigger
            value="borderline"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Borderline Review
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Export Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="borderline" className="mt-4">
          <BorderlineReview />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <ExportReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

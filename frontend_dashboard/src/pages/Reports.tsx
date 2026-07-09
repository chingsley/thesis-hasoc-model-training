import { BorderlineReview } from '@/components/reports/BorderlineReview'
import { ExportReport } from '@/components/reports/ExportReport'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Reports() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="borderline" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="borderline">Borderline Review</TabsTrigger>
          <TabsTrigger value="export">Export Report</TabsTrigger>
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

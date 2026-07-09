import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BorderlineReview } from '@/components/reports/BorderlineReview'
import { ExportReport } from '@/components/reports/ExportReport'
import { useBorderlinePosts } from '@/hooks/use-posts'
import { Loader2 } from 'lucide-react'

export default function Reports() {
  const { data: borderline, isLoading } = useBorderlinePosts()

  return (
    <Tabs defaultValue="borderline" className="space-y-4">
      <TabsList className="rounded-xl">
        <TabsTrigger value="borderline">Borderline Review</TabsTrigger>
        <TabsTrigger value="export">Export Report</TabsTrigger>
      </TabsList>
      <TabsContent value="borderline">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <BorderlineReview posts={borderline ?? []} />
        )}
      </TabsContent>
      <TabsContent value="export">
        <ExportReport />
      </TabsContent>
    </Tabs>
  )
}

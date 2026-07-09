import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { PostClusters } from '@/components/reports/PostClusters'
import { useToxicTerms, useDriftData, useVolumeData, useClusters } from '@/hooks/use-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function Analysis() {
  const { data: terms, isLoading: termsLoading } = useToxicTerms()
  const { data: drift, isLoading: driftLoading } = useDriftData()
  const { data: volume, isLoading: volumeLoading } = useVolumeData()
  const { data: clusters, isLoading: clustersLoading } = useClusters()

  return (
    <Tabs defaultValue="wordcloud" className="space-y-4">
      <TabsList className="rounded-xl">
        <TabsTrigger value="wordcloud">Word Cloud</TabsTrigger>
        <TabsTrigger value="drift">Model Drift</TabsTrigger>
        <TabsTrigger value="volume">Volume</TabsTrigger>
        <TabsTrigger value="clusters">Clusters</TabsTrigger>
      </TabsList>

      <TabsContent value="wordcloud">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Toxic Term Word Cloud</CardTitle>
          </CardHeader>
          <CardContent>
            {termsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <ToxicWordCloud terms={terms ?? []} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="drift">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Model Drift Monitor</CardTitle>
          </CardHeader>
          <CardContent>
            {driftLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              drift && <ModelDriftChart data={drift} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="volume">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Post Volume by Label</CardTitle>
          </CardHeader>
          <CardContent>
            {volumeLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              volume && <VolumeChart data={volume} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="clusters">
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle>Similar Post Clusters</CardTitle>
          </CardHeader>
          <CardContent>
            {clustersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <PostClusters clusters={clusters ?? []} />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

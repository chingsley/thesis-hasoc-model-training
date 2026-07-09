import { useQuery } from '@tanstack/react-query'
import { fetchClusters, fetchVolumeData } from '@/lib/api/client'
import { useDriftData } from '@/hooks/use-metrics'
import { useDashboardStore } from '@/lib/store/dashboard'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { PostClusters } from '@/components/reports/PostClusters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

export default function Analysis() {
  const language = useDashboardStore((s) => s.language)
  const { data: driftData, isLoading: driftLoading } = useDriftData()
  const { data: volumeData } = useQuery({
    queryKey: ['volume'],
    queryFn: fetchVolumeData,
  })
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters', language],
    queryFn: () => fetchClusters(language),
  })

  return (
    <div className="space-y-6">
      <Tabs defaultValue="wordcloud" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="wordcloud">Toxic Word Cloud</TabsTrigger>
          <TabsTrigger value="drift">Model Drift</TabsTrigger>
          <TabsTrigger value="volume">Post Volume</TabsTrigger>
          <TabsTrigger value="clusters">Post Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="wordcloud" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Toxic Term Word Cloud</CardTitle>
            </CardHeader>
            <CardContent>
              <ToxicWordCloud />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Confidence Drift Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {driftLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <ModelDriftChart data={driftData ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Post Volume Per Hour</CardTitle>
            </CardHeader>
            <CardContent>
              {volumeData && <VolumeChart data={volumeData} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Similar Post Clusters (Coordinated Attack Detection)</CardTitle>
            </CardHeader>
            <CardContent>
              {clustersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <PostClusters clusters={clusters ?? []} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

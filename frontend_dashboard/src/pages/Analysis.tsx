import { useQuery } from '@tanstack/react-query'
import { fetchClusters, fetchVolumeData } from '@/lib/api/client'
import { useDriftData } from '@/hooks/use-metrics'
import { useDashboardStore } from '@/lib/store/dashboard'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumeChart } from '@/components/charts/VolumeChart'
import { PostClusters } from '@/components/reports/PostClusters'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

export default function Analysis() {
  const language = useDashboardStore((s) => s.language)
  const { data: driftData, isLoading: driftLoading } = useDriftData()
  const { data: volumeData } = useQuery({
    queryKey: ['volume', language],
    queryFn: () => fetchVolumeData(language),
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <SectionTitle>Frequent Terms in Toxic Posts</SectionTitle>
                <CardDescription>
                  Most common words in your Hate/Abuse predictions — surfaces the frequent targets
                  (e.g. a group or place name), whether or not the word itself is toxic.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ToxicWordCloud source="frequent" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <SectionTitle>Most Toxic Terms</SectionTitle>
                <CardDescription>
                  Words that measurably raise the model&apos;s toxicity score, measured by
                  re-classifying each post with the word removed (leave-one-out).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ToxicWordCloud source="toxic" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drift" className="mt-4">
          <Card>
            <CardHeader>
              <SectionTitle>Model Confidence Drift Over Time</SectionTitle>
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
              <SectionTitle>Post Volume Per Hour</SectionTitle>
            </CardHeader>
            <CardContent>
              {volumeData && <VolumeChart data={volumeData} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="mt-4">
          <Card>
            <CardHeader>
              <SectionTitle>Similar Post Clusters (Coordinated Attack Detection)</SectionTitle>
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

import { useQuery } from '@tanstack/react-query'
import { fetchClusters } from '@/lib/api/client'
import { useDriftData } from '@/hooks/use-metrics'
import { useDashboardStore } from '@/lib/store/dashboard'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumePanel } from '@/components/charts/VolumePanel'
import { PostClusters } from '@/components/reports/PostClusters'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

export default function Analysis() {
  const language = useDashboardStore((s) => s.language)
  const { data: driftData, isLoading: driftLoading } = useDriftData()
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters', language],
    queryFn: () => fetchClusters(language),
  })

  return (
    <div className="space-y-8">
      <SectionTitle description="Explore toxic language patterns, confidence drift, volume trends, and coordinated clusters.">
        Analysis
      </SectionTitle>

      <Tabs defaultValue="wordcloud" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-[4px] border border-[var(--hg-border)] bg-white p-1 shadow-[var(--hg-shadow)]">
          <TabsTrigger
            value="wordcloud"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Toxic Word Cloud
          </TabsTrigger>
          <TabsTrigger
            value="drift"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Model Drift
          </TabsTrigger>
          <TabsTrigger
            value="volume"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Post Volume
          </TabsTrigger>
          <TabsTrigger
            value="clusters"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Post Clusters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wordcloud" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <SectionTitle
                  size="md"
                  description="Most common words in your Hate and Abuse predictions."
                >
                  Frequent Terms in Toxic Posts
                </SectionTitle>
              </CardHeader>
              <CardContent>
                <ToxicWordCloud source="frequent" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <SectionTitle
                  size="md"
                  description="Words that raise toxicity when present (leave-one-out)."
                >
                  Most Toxic Terms
                </SectionTitle>
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
              <SectionTitle size="md" description="How prediction confidence shifts over time.">
                Model Confidence Drift
              </SectionTitle>
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
          <VolumePanel />
        </TabsContent>

        <TabsContent value="clusters" className="mt-4">
          <Card>
            <CardHeader>
              <SectionTitle
                size="md"
                description="Near-duplicate posts that may indicate coordinated attacks."
              >
                Similar Post Clusters
              </SectionTitle>
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

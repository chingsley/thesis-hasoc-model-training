import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchClusters } from '@/lib/api/client'
import { useDriftData } from '@/hooks/use-metrics'
import { useDashboardStore } from '@/lib/store/dashboard'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumePanel } from '@/components/charts/VolumePanel'
import { PostClusters } from '@/components/reports/PostClusters'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

const TABS = [
  {
    value: 'wordcloud',
    label: 'Word Cloud',
    title: 'Toxic Word Cloud',
    description: 'Frequent and high-impact terms in Hate and Abuse predictions.',
  },
  {
    value: 'drift',
    label: 'Model Drift',
    title: 'Model Confidence Drift',
    description: 'How prediction confidence shifts over time.',
  },
  {
    value: 'volume',
    label: 'Post Volume',
    title: 'Post Volume',
    description: 'Classification volume trends for the active language.',
  },
  {
    value: 'clusters',
    label: 'Clusters',
    title: 'Similar Post Clusters',
    description: 'Near-duplicate posts that may indicate coordinated attacks.',
  },
] as const

type AnalysisTab = (typeof TABS)[number]['value']

export default function Analysis() {
  const language = useDashboardStore((s) => s.language)
  const [activeTab, setActiveTab] = useState<AnalysisTab>('wordcloud')
  const { data: driftData, isLoading: driftLoading } = useDriftData()
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters', language],
    queryFn: () => fetchClusters(language),
  })

  const current = useMemo(
    () => TABS.find((tab) => tab.value === activeTab) ?? TABS[0],
    [activeTab],
  )

  return (
    <div className="space-y-8">
      <SectionTitle description="Explore toxic language patterns, confidence drift, volume trends, and coordinated clusters.">
        Analysis
      </SectionTitle>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AnalysisTab)}
          className="w-full gap-0"
        >
          <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
            <SectionTitle size="md" description={current.description}>
              {current.title}
            </SectionTitle>
            <CardAction className="flex flex-col items-end gap-2 self-center">
              <TabsList className="h-auto w-fit max-w-full flex-wrap justify-end gap-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-auto flex-none rounded-[4px] px-2.5 py-1.5 text-xs font-medium text-[var(--hg-muted)] shadow-none transition-colors hover:bg-[var(--hg-soft)] hover:text-black data-active:bg-white data-active:text-[var(--hg-ink)] data-active:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardAction>
          </CardHeader>

          <CardContent className="pt-5">
            <TabsContent value="wordcloud" className="mt-0">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4 md:p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--hg-ink)]">
                      Frequent Terms in Toxic Posts
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                      Most common words in your Hate and Abuse predictions.
                    </p>
                  </div>
                  <ToxicWordCloud source="frequent" />
                </div>
                <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4 md:p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--hg-ink)]">Most Toxic Terms</h3>
                    <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                      Words that raise toxicity when present (leave-one-out).
                    </p>
                  </div>
                  <ToxicWordCloud source="toxic" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="drift" className="mt-0">
              {driftLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--hg-subtle)]" />
                </div>
              ) : (
                <ModelDriftChart data={driftData ?? []} />
              )}
            </TabsContent>

            <TabsContent value="volume" className="mt-0">
              <VolumePanel embedded />
            </TabsContent>

            <TabsContent value="clusters" className="mt-0">
              {clustersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--hg-subtle)]" />
                </div>
              ) : (
                <PostClusters clusters={clusters ?? []} />
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}

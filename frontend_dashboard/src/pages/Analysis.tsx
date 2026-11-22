import { useMemo, useState } from 'react'
import { useDriftData } from '@/hooks/use-metrics'
import { ToxicWordCloud } from '@/components/charts/ToxicWordCloud'
import { ModelDriftChart } from '@/components/charts/ModelDriftChart'
import { VolumePanel } from '@/components/charts/VolumePanel'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { TechnicalName } from '@/components/ui/technical-name'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlainDrift } from '@/components/plain/PlainDrift'
import { PlainVolume } from '@/components/plain/PlainVolume'
import { PlainWordList } from '@/components/plain/PlainWordList'
import { useViewMode } from '@/lib/store/view-mode'
import { VOLUME_CHART_TITLE } from '@/lib/volume-range'

const TABS = [
  {
    value: 'wordcloud',
    label: 'Word Cloud',
    title: 'Toxic Word Cloud',
    description: 'Frequent and high-impact terms in Hate and Abuse predictions.',
    plainTitle: 'Words in Hateful and Abusive Posts',
    plainDescription: 'The words that appear most, and the words that matter most to HateGuard.',
  },
  {
    value: 'drift',
    label: 'Model Drift',
    title: 'Model Confidence Drift',
    description: 'How prediction confidence shifts over time.',
    plainTitle: 'Is HateGuard Still Working as Expected?',
    plainDescription: 'Whether HateGuard has become more or less sure of its labels over time.',
  },
  {
    value: 'volume',
    label: 'Post Volume',
    title: VOLUME_CHART_TITLE,
    description: 'Classification volume trends for the active language.',
    plainTitle: VOLUME_CHART_TITLE,
    plainDescription: 'How many posts HateGuard checked, and what it found.',
  },
] as const

type AnalysisTab = (typeof TABS)[number]['value']

export default function Analysis() {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('wordcloud')
  const { data: driftData, isLoading: driftLoading } = useDriftData()
  const viewMode = useViewMode()
  const plain = viewMode === 'plain'

  const current = useMemo(
    () => TABS.find((tab) => tab.value === activeTab) ?? TABS[0],
    [activeTab],
  )

  return (
    <div className="space-y-8">
      <PageHeader
        description={
          plain
            ? 'Common words in harmful posts, how steady HateGuard is, and how many posts it checked.'
            : 'Explore toxic language patterns, confidence drift, and volume trends.'
        }
      >
        Analysis
      </PageHeader>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AnalysisTab)}
          className="w-full gap-0"
        >
          <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
            <div className="min-w-0">
              <SectionTitle
                size="md"
                description={plain ? current.plainDescription : current.description}
                technicalName={plain ? current.title : undefined}
              >
                {plain ? current.plainTitle : current.title}
              </SectionTitle>
            </div>
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
                    <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--hg-ink)]">
                      {plain ? 'Words Used Most Often' : 'Frequent Terms in Toxic Posts'}
                      {plain ? <TechnicalName>Frequent Terms in Toxic Posts</TechnicalName> : null}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                      {plain
                        ? 'The words that appear most often in posts labelled hateful or abusive (top 10).'
                        : 'Most common words in your Hate and Abuse predictions.'}
                    </p>
                  </div>
                  {plain ? <PlainWordList source="frequent" /> : <ToxicWordCloud source="frequent" />}
                </div>
                <div className="space-y-3 rounded-[4px] border border-[var(--hg-border)] p-4 md:p-5">
                  <div>
                    <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[var(--hg-ink)]">
                      {plain ? 'Words That Raise the Alarm Most' : 'Most Toxic Terms'}
                      {plain ? <TechnicalName>Most Toxic Terms</TechnicalName> : null}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--hg-muted)]">
                      {plain
                        ? 'The words that most push HateGuard towards a hateful or abusive label when they are in a post (top 10).'
                        : 'Words that raise toxicity when present (leave-one-out).'}
                    </p>
                  </div>
                  {plain ? <PlainWordList source="toxic" /> : <ToxicWordCloud source="toxic" />}
                </div>
              </div>
              {plain ? (
                <p className="mt-4 text-xs leading-relaxed text-[var(--hg-muted)]">
                  A word in these lists does not make a post hateful or abusive by itself. The
                  meaning depends on how the word is used.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="drift" className="mt-0">
              {driftLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--hg-subtle)]" />
                </div>
              ) : (
                plain ? <PlainDrift data={driftData ?? []} /> : <ModelDriftChart data={driftData ?? []} />
              )}
            </TabsContent>

            <TabsContent value="volume" className="mt-0">
              {plain ? <PlainVolume embedded /> : <VolumePanel embedded />}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}

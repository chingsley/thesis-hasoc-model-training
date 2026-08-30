import { useMemo, useState } from 'react'
import { TextTester } from '@/components/testing/TextTester'
import { BatchScanner } from '@/components/testing/BatchScanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'

const TABS = [
  {
    value: 'single',
    label: 'Single Text',
    title: 'Evaluate Text',
    description: 'Paste one message and run classification.',
  },
  {
    value: 'batch',
    label: 'Batch Scanner',
    title: 'Batch Text Scanner',
    description: 'Upload or paste many texts to classify in one run.',
  },
] as const

type TestingTab = (typeof TABS)[number]['value']

export default function Testing() {
  const [activeTab, setActiveTab] = useState<TestingTab>('single')
  const current = useMemo(
    () => TABS.find((tab) => tab.value === activeTab) ?? TABS[0],
    [activeTab],
  )

  return (
    <div className="space-y-8">
      <SectionTitle description="Classify a single text or scan a batch. Results are logged to your account for the active language.">
        Testing Tools
      </SectionTitle>

      <Card>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TestingTab)}
          className="w-full gap-0"
        >
          <CardHeader className="gap-4 border-b border-[var(--hg-border)] pb-4">
            <SectionTitle size="md" description={current.description}>
              {current.title}
            </SectionTitle>
            <CardAction className="flex flex-col items-end gap-2 self-center">
              <TabsList className="h-auto w-fit justify-end gap-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5">
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
            <TabsContent value="single" className="mt-0">
              <TextTester />
            </TabsContent>
            <TabsContent value="batch" className="mt-0">
              <BatchScanner />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}

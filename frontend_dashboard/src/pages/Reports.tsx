import { useMemo, useState } from 'react'
import { BorderlineReview } from '@/components/reports/BorderlineReview'
import { ExportReport } from '@/components/reports/ExportReport'
import { SectionTitle } from '@/components/ui/data-source-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  {
    value: 'borderline',
    label: 'Borderline',
    title: 'Reports',
    description: 'Review uncertain predictions and export flagged posts for incident reporting.',
  },
  {
    value: 'export',
    label: 'Export',
    title: 'Reports',
    description: 'Review uncertain predictions and export flagged posts for incident reporting.',
  },
] as const

type ReportsTab = (typeof TABS)[number]['value']

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('borderline')
  const current = useMemo(
    () => TABS.find((tab) => tab.value === activeTab) ?? TABS[0],
    [activeTab],
  )

  return (
    <div className="space-y-8">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ReportsTab)}
        className="w-full gap-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle description={current.description}>
            {current.title}
          </SectionTitle>
          <TabsList className="h-auto w-fit shrink-0 justify-end gap-0 rounded-[4px] border border-[var(--hg-border)] bg-[var(--hg-canvas)] p-0.5">
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
        </div>

        <TabsContent value="borderline" className="mt-0">
          <BorderlineReview />
        </TabsContent>
        <TabsContent value="export" className="mt-0">
          <ExportReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}

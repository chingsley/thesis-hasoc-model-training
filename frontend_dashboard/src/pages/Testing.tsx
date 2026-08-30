import { TextTester } from '@/components/testing/TextTester'
import { BatchScanner } from '@/components/testing/BatchScanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/data-source-badge'

export default function Testing() {
  return (
    <div className="space-y-8">
      <SectionTitle description="Classify a single text or scan a batch. Results are logged to your account for the active language.">
        Testing Tools
      </SectionTitle>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-[4px] border border-[var(--hg-border)] bg-white p-1 shadow-[var(--hg-shadow)]">
          <TabsTrigger
            value="single"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Single Text Tester
          </TabsTrigger>
          <TabsTrigger
            value="batch"
            className="rounded-[4px] data-active:bg-[var(--hg-soft)] data-active:text-black data-active:shadow-none"
          >
            Batch Scanner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <Card>
            <CardHeader>
              <SectionTitle size="md" description="Paste one message and run classification.">
                Evaluate Text
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <TextTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <Card>
            <CardHeader>
              <SectionTitle size="md" description="Upload or paste many texts to classify in one run.">
                Batch Text Scanner
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <BatchScanner />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

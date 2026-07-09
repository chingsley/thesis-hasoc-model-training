import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TextTester } from '@/components/testing/TextTester'
import { BatchScanner } from '@/components/testing/BatchScanner'

export default function Testing() {
  return (
    <Tabs defaultValue="single" className="space-y-4">
      <TabsList className="rounded-xl">
        <TabsTrigger value="single">Single Text</TabsTrigger>
        <TabsTrigger value="batch">Batch Scanner</TabsTrigger>
      </TabsList>
      <TabsContent value="single">
        <TextTester />
      </TabsContent>
      <TabsContent value="batch">
        <BatchScanner />
      </TabsContent>
    </Tabs>
  )
}

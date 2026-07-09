import { TextTester } from '@/components/testing/TextTester'
import { BatchScanner } from '@/components/testing/BatchScanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Testing() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="single" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="single">Single Text Tester</TabsTrigger>
          <TabsTrigger value="batch">Batch Scanner</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test a Single Text</CardTitle>
            </CardHeader>
            <CardContent>
              <TextTester />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Text Scanner</CardTitle>
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

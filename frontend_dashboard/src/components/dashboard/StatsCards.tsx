import { Card, CardContent } from '@/components/ui/card'
import { FileText, MessageSquare, AlertTriangle, Flame } from 'lucide-react'

interface StatsCardsProps {
  total: number
  normal: number
  abuse: number
  hate: number
}

export function StatsCards({ total, normal, abuse, hate }: StatsCardsProps) {
  const items = [
    { label: 'Posts Processed', value: total, icon: FileText, color: 'text-blue-600' },
    { label: 'Normal Posts', value: normal, icon: MessageSquare, color: 'text-green-600' },
    { label: 'Abusive Posts', value: abuse, icon: AlertTriangle, color: 'text-yellow-600' },
    { label: 'Hateful Posts', value: hate, icon: Flame, color: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

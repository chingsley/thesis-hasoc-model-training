import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, MessageSquare, AlertTriangle, Flame, ArrowRight } from 'lucide-react'
import type { Label } from '@/lib/types'

interface StatsCardsProps {
  total: number
  normal: number
  abuse: number
  hate: number
}

export function StatsCards({ total, normal, abuse, hate }: StatsCardsProps) {
  const navigate = useNavigate()

  const items: { label: string; value: number; icon: typeof FileText; color: string; filter?: Label }[] = [
    { label: 'Posts Processed', value: total, icon: FileText, color: 'text-primary' },
    { label: 'Normal Posts', value: normal, icon: MessageSquare, color: 'text-green-600', filter: 'Normal' },
    { label: 'Abusive Posts', value: abuse, icon: AlertTriangle, color: 'text-yellow-600', filter: 'Abuse' },
    { label: 'Hateful Posts', value: hate, icon: Flame, color: 'text-red-600', filter: 'Hate' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-muted ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
            {item.filter && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full justify-between text-primary hover:text-primary"
                onClick={() => navigate(`/triage?label=${item.filter}`)}
              >
                View posts
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

import type { PerClassMetrics as PerClassMetricsType } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PerClassMetricsProps {
  metrics: Record<string, PerClassMetricsType>
}

export function PerClassMetrics({ metrics }: PerClassMetricsProps) {
  const data = Object.entries(metrics).map(([label, m]) => ({
    class: label,
    Precision: Number((m.precision * 100).toFixed(1)),
    Recall: Number((m.recall * 100).toFixed(1)),
    F1: Number((m.f1 * 100).toFixed(1)),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="class" className="text-muted-foreground" />
        <YAxis className="text-muted-foreground" domain={[0, 100]} />
        <Tooltip
          formatter={(value: unknown) => typeof value === 'number' ? `${value}%` : String(value)}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Bar dataKey="Precision" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Recall" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="F1" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

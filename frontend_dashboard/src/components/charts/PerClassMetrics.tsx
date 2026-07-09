import type { ModelMetrics } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PerClassMetricsProps {
  metrics: ModelMetrics
}

export function PerClassMetrics({ metrics }: PerClassMetricsProps) {
  const data = (['Normal', 'Abuse', 'Hate'] as const).map((label) => ({
    label,
    precision: metrics.per_class[label].precision * 100,
    recall: metrics.per_class[label].recall * 100,
    f1: metrics.per_class[label].f1 * 100,
    support: metrics.per_class[label].support,
  }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : String(v)} />
        <Legend />
        <Bar dataKey="precision" fill="hsl(var(--primary))" name="Precision" radius={[4, 4, 0, 0]} />
        <Bar dataKey="recall" fill="#22c55e" name="Recall" />
        <Bar dataKey="f1" fill="#eab308" name="F1" />
      </BarChart>
    </ResponsiveContainer>
  )
}

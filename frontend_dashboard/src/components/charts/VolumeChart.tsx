import type { VolumeDataPoint } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface VolumeChartProps {
  data: VolumeDataPoint[]
}

export function VolumeChart({ data }: VolumeChartProps) {
  const recent = data.slice(-168).filter((_, i) => i % 6 === 0)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={recent}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={6} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend />
        <Bar dataKey="normal_count" stackId="a" fill="#22c55e" name="Normal" radius={[0, 0, 0, 0]} />
        <Bar dataKey="abuse_count" stackId="a" fill="#eab308" name="Abuse" />
        <Bar dataKey="hate_count" stackId="a" fill="#ef4444" name="Hate" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

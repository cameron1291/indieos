'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  data: { range: string; count: number }[]
}

const BAR_COLOURS = ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6']

export function CrawlerStatusChart({ data }: Props) {
  if (data.every(d => d.count === 0)) {
    return <p className="text-sm text-zinc-500">No scored opportunities in last 30 days.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis dataKey="range" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          formatter={(value) => [value, 'opportunities']}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLOURS[i % BAR_COLOURS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

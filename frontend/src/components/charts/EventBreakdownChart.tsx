import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts'
import type { EventBreakdownItem } from '@/types'

interface EventBreakdownChartProps {
    data: EventBreakdownItem[]
    isLoading?: boolean
}

const COLORS = ['#22d3ee', '#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']

function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload as EventBreakdownItem
    return (
        <div className="bg-navy-800 border border-white/[0.08] rounded-xl p-3 shadow-card text-sm">
            <p className="font-semibold text-white mb-1">{d.event_name}</p>
            <p className="text-slate-400">Events: <span className="text-white font-medium">{d.total_count?.toLocaleString()}</span></p>
            <p className="text-slate-400">Users: <span className="text-white font-medium">{d.unique_users?.toLocaleString()}</span></p>
        </div>
    )
}

export default function EventBreakdownChart({ data, isLoading }: EventBreakdownChartProps) {
    if (isLoading) {
        return (
            <div className="h-72 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
            </div>
        )
    }

    if (!data?.length) {
        return (
            <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                No breakdown data for this period
            </div>
        )
    }

    const sorted = [...data].sort((a, b) => b.total_count - a.total_count).slice(0, 8)

    return (
        <ResponsiveContainer width="100%" height={288}>
            <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <XAxis
                    type="number"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                />
                <YAxis
                    type="category"
                    dataKey="event_name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="total_count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {sorted.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

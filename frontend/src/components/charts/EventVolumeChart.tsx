import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { DailyMetricPoint } from '@/types'

interface EventVolumeChartProps {
    data: DailyMetricPoint[]
    isLoading?: boolean
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-navy-800 border border-white/[0.08] rounded-xl p-3 shadow-card text-sm">
            <p className="text-slate-400 mb-2 text-xs">
                {label ? format(parseISO(label), 'MMM d, yyyy') : ''}
            </p>
            {payload.map((entry: any) => (
                <div key={entry.dataKey} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-slate-300 capitalize">
                        {entry.dataKey === 'event_count' ? 'Events' : 'Users'}:
                    </span>
                    <span className="font-semibold text-white ml-1">
                        {entry.value?.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    )
}

export default function EventVolumeChart({ data, isLoading }: EventVolumeChartProps) {
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
                No event data for this period
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={288}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) => {
                        try { return format(parseISO(d), 'MMM d') } catch { return d }
                    }}
                />
                <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
                <Legend
                    formatter={(value) => (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>
                            {value === 'event_count' ? 'Events' : 'Unique Users'}
                        </span>
                    )}
                />
                <Area
                    type="monotone"
                    dataKey="event_count"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#gradEvents)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#22d3ee', strokeWidth: 0 }}
                />
                <Area
                    type="monotone"
                    dataKey="unique_users"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="url(#gradUsers)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#60a5fa', strokeWidth: 0 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}

import { useState } from 'react'
import { Activity, Users, RefreshCw, BarChart2 } from 'lucide-react'
import KpiCard from '@/components/ui/KpiCard'
import EventVolumeChart from '@/components/charts/EventVolumeChart'
import EventBreakdownChart from '@/components/charts/EventBreakdownChart'
import { useOverview, useEventBreakdown } from '@/hooks/useDashboard'
import type { DateRange } from '@/hooks/useDashboard'

const DATE_RANGES: { label: string; value: DateRange }[] = [
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: '90 days', value: '90d' },
]

export default function DashboardPage() {
    const [range, setRange] = useState<DateRange>('30d')

    const { data: overview, isLoading: overviewLoading, refetch } = useOverview(range)
    const { data: breakdown, isLoading: breakdownLoading } = useEventBreakdown(range)

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Product analytics overview
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Date range selector */}
                    <div className="flex items-center gap-1 bg-navy-800 border border-white/[0.07] rounded-xl p-1">
                        {DATE_RANGES.map(({ label, value }) => (
                            <button
                                key={value}
                                id={`range-${value}`}
                                onClick={() => setRange(value)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${range === value
                                        ? 'bg-cyan-500/15 text-accent-cyan border border-cyan-500/30'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Refresh */}
                    <button
                        id="dashboard-refresh-btn"
                        onClick={() => refetch()}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-navy-800 border border-white/[0.07] text-slate-400 hover:text-white hover:border-white/[0.12] transition-all duration-150"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Total Events"
                    value={overview?.total_events ?? 0}
                    icon={<Activity size={20} />}
                    color="cyan"
                    subtitle={`${range === '7d' ? 'Last 7' : range === '30d' ? 'Last 30' : 'Last 90'} days`}
                    isLoading={overviewLoading}
                />
                <KpiCard
                    title="Unique Users"
                    value={overview?.total_unique_users ?? 0}
                    icon={<Users size={20} />}
                    color="blue"
                    subtitle="Active users in period"
                    isLoading={overviewLoading}
                />
                <KpiCard
                    title="Event Types"
                    value={breakdown?.events?.length ?? 0}
                    icon={<BarChart2 size={20} />}
                    color="green"
                    subtitle="Distinct event names"
                    isLoading={breakdownLoading}
                />
                <KpiCard
                    title="Avg / Day"
                    value={
                        overview && overview.total_events > 0
                            ? Math.round(
                                overview.total_events /
                                (range === '7d' ? 7 : range === '30d' ? 30 : 90)
                            )
                            : 0
                    }
                    icon={<Activity size={20} />}
                    color="amber"
                    subtitle="Events per day average"
                    isLoading={overviewLoading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Event Volume - takes 2/3 width */}
                <div className="lg:col-span-2 bg-navy-800/60 border border-white/[0.06] rounded-2xl p-6 shadow-card">
                    <div className="mb-5">
                        <h2 className="text-base font-semibold text-white">Event Volume</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Daily events and unique users</p>
                    </div>
                    <EventVolumeChart
                        data={overview?.daily_series ?? []}
                        isLoading={overviewLoading}
                    />
                </div>

                {/* Event Breakdown - takes 1/3 width */}
                <div className="bg-navy-800/60 border border-white/[0.06] rounded-2xl p-6 shadow-card">
                    <div className="mb-5">
                        <h2 className="text-base font-semibold text-white">Top Events</h2>
                        <p className="text-slate-500 text-xs mt-0.5">By total count</p>
                    </div>
                    <EventBreakdownChart
                        data={breakdown?.events ?? []}
                        isLoading={breakdownLoading}
                    />
                </div>
            </div>
        </div>
    )
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, RefreshCw, LayoutTemplate } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { retentionApi } from '@/api'
import RetentionHeatmap from '@/components/charts/RetentionHeatmap'
import type { RetentionCohortRow } from '@/types'

type RetentionPeriod = '7d' | '14d' | '30d'

export default function RetentionPage() {
    const [period, setPeriod] = useState<RetentionPeriod>('14d')

    const { data: matrix, isLoading, refetch } = useQuery({
        queryKey: ['retention', period],
        queryFn: () => {
            const today = new Date()
            const days = period === '7d' ? 7 : period === '14d' ? 14 : 30
            return retentionApi.get({
                date_from: format(subDays(today, days), 'yyyy-MM-dd'),
                date_to: format(today, 'yyyy-MM-dd')
            })
        },
    })

    // Group cohorts if needed, or simply pass the data to the heatmap
    const cohorts: RetentionCohortRow[] = matrix?.cohorts ?? []

    const PERIODS: { label: string; value: RetentionPeriod }[] = [
        { label: 'Last 7 Days', value: '7d' },
        { label: 'Last 14 Days', value: '14d' },
        { label: 'Last 30 Days', value: '30d' },
    ]

    return (
        <div className="space-y-6 max-w-7xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <LayoutTemplate size={24} className="text-accent-cyan" />
                        Retention Analytics
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Analyze user engagement and drop-off over time by cohort.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Period selector */}
                    <div className="flex items-center gap-1 bg-navy-800 border border-white/[0.07] rounded-xl p-1">
                        {PERIODS.map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setPeriod(value)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${period === value
                                        ? 'bg-cyan-500/15 text-accent-cyan border border-cyan-500/30'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                <Calendar size={14} className={period === value ? 'text-accent-cyan' : 'text-slate-500'} />
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={() => refetch()}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-navy-800 border border-white/[0.07] text-slate-400 hover:text-white hover:border-white/[0.12] transition-all duration-150"
                        title="Refresh Data"
                    >
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-navy-800/60 border border-white/[0.06] rounded-2xl p-6 shadow-card overflow-hidden relative">
                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="mb-6">
                    <h2 className="text-base font-semibold text-white">Cohort Retention Matrix</h2>
                    <p className="text-slate-400 text-xs mt-0.5 max-w-2xl">
                        Displays the percentage of users from each daily cohort who returned to trigger any active event on subsequent days. "Day 0" is the day they first appeared in the cohort.
                    </p>
                </div>

                <RetentionHeatmap cohorts={cohorts} isLoading={isLoading} />

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center justify-end gap-2 text-xs text-slate-400">
                    <span>Lower Retention</span>
                    <div className="flex gap-1 h-3">
                        <div className="w-6 rounded-sm bg-navy-800/40 border border-white/[0.05]" />
                        <div className="w-6 rounded-sm bg-cyan-900/40" />
                        <div className="w-6 rounded-sm bg-cyan-800/60" />
                        <div className="w-6 rounded-sm bg-cyan-700/80" />
                        <div className="w-6 rounded-sm bg-cyan-600" />
                        <div className="w-6 rounded-sm bg-cyan-500" />
                    </div>
                    <span>Higher Retention</span>
                </div>
            </div>
        </div>
    )
}

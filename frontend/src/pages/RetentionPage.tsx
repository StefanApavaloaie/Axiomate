import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, RefreshCw, LayoutTemplate, Settings2, Download } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { retentionApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'
import RetentionHeatmap from '@/components/charts/RetentionHeatmap'
import { downloadCsv } from '@/utils/csvExport'

type RetentionPeriod = '7d' | '14d' | '30d'

export default function RetentionPage() {
    const workspaceId = WorkspaceStorage.get()
    const [period, setPeriod] = useState<RetentionPeriod>('14d')
    const [initialEvent, setInitialEvent] = useState('page_view')
    const [returnEvent, setReturnEvent] = useState('page_view')
    const [showConfig, setShowConfig] = useState(false)
    const [downloading, setDownloading] = useState(false)

    const handleExport = async () => {
        if (!workspaceId) return
        setDownloading(true)
        try {
            const today = new Date()
            const days = period === '7d' ? 7 : period === '14d' ? 14 : 30
            const dateFrom = format(subDays(today, days), 'yyyy-MM-dd')
            const dateTo = format(today, 'yyyy-MM-dd')
            const params = new URLSearchParams({
                initial_event: initialEvent,
                return_event: returnEvent,
                date_from: dateFrom,
                date_to: dateTo,
                granularity: 'day',
            })
            await downloadCsv(
                `http://localhost:8000/api/v1/retention/${workspaceId}/export?${params}`,
                `axiomate_retention_${period}.csv`
            )
        } catch (e) {
            console.error('Export failed', e)
        } finally {
            setDownloading(false)
        }
    }

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['retention', period, initialEvent, returnEvent, workspaceId],
        queryFn: () => {
            const today = new Date()
            const days = period === '7d' ? 7 : period === '14d' ? 14 : 30
            return retentionApi.get(workspaceId!, {
                date_from: format(subDays(today, days), 'yyyy-MM-dd'),
                date_to: format(today, 'yyyy-MM-dd'),
                initial_event: initialEvent,
                return_event: returnEvent,
                granularity: 'day',
            })
        },
        enabled: !!workspaceId && !!initialEvent && !!returnEvent,
    })

    const cohorts = data?.cohorts ?? []

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
                        Retention Cohorts
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Track how many users come back over time.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Period selector */}
                    <div className="flex items-center gap-1 bg-navy-800 border border-white/[0.07] rounded-xl p-1">
                        {PERIODS.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => setPeriod(p.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    period === p.value
                                        ? 'bg-cyan-500/15 text-accent-cyan'
                                        : 'text-slate-500 hover:text-white'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Config toggle */}
                    <button
                        onClick={() => setShowConfig((v) => !v)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                            showConfig
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-accent-cyan'
                                : 'border-white/[0.07] bg-navy-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Settings2 size={14} />
                        Events
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-800 border border-white/[0.07] text-slate-400 hover:text-white text-sm transition-all"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                    </button>
                    {/* Export CSV */}
                    <button
                        id="retention-export-btn"
                        onClick={handleExport}
                        disabled={downloading}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-navy-800 border border-white/[0.07] text-slate-400 hover:text-white text-sm transition-all disabled:opacity-50"
                        title="Export retention as CSV"
                    >
                        <Download size={14} className={downloading ? 'animate-bounce' : ''} />
                        {downloading ? 'Exporting…' : 'Export CSV'}
                    </button>
                </div>
            </div>

            {/* Event Config Panel */}
            {showConfig && (
                <div className="bg-navy-800/60 border border-white/[0.06] rounded-2xl p-5 flex items-end gap-4 animate-fade-in">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Initial Event (cohort trigger)
                        </label>
                        <input
                            value={initialEvent}
                            onChange={(e) => setInitialEvent(e.target.value)}
                            placeholder="e.g. page_view"
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Return Event (retention signal)
                        </label>
                        <input
                            value={returnEvent}
                            onChange={(e) => setReturnEvent(e.target.value)}
                            placeholder="e.g. page_view"
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <div className="text-xs text-slate-500 pb-3 max-w-[200px]">
                        <Calendar size={12} className="inline mr-1" />
                        Cohorts group users by their first <em>{initialEvent || '…'}</em> event, then measure who fires <em>{returnEvent || '…'}</em> in later periods.
                    </div>
                </div>
            )}

            {/* No workspace selected */}
            {!workspaceId && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300 text-sm">
                    Please select a workspace using the switcher in the top bar.
                </div>
            )}

            {/* Heatmap */}
            <div className="bg-navy-800/60 border border-white/[0.06] rounded-2xl p-6 shadow-card">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-white font-semibold">Retention Matrix</h2>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {data
                                ? `${cohorts.length} cohorts · ${initialEvent} → ${returnEvent} · ${data.granularity}`
                                : 'Loading…'}
                        </p>
                    </div>
                    {cohorts.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Low</span>
                            <div className="flex gap-1">
                                {['bg-cyan-900/40', 'bg-cyan-800/60', 'bg-cyan-700/80', 'bg-cyan-600', 'bg-cyan-500'].map((c, i) => (
                                    <div key={i} className={`w-4 h-4 rounded ${c}`} />
                                ))}
                            </div>
                            <span>High</span>
                        </div>
                    )}
                </div>

                <RetentionHeatmap cohorts={cohorts} isLoading={isLoading} />
            </div>
        </div>
    )
}

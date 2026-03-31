import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { Plus, Filter, ChevronRight, Calendar } from 'lucide-react'
import { funnelsApi } from '@/api'
import FunnelChart from '@/components/charts/FunnelChart'
import CreateFunnelModal from '@/components/shared/CreateFunnelModal'
import type { FunnelResponse } from '@/types'

type DateRange = '7d' | '30d' | '90d'

function getRange(r: DateRange) {
    const today = new Date()
    const days = r === '7d' ? 7 : r === '30d' ? 30 : 90
    return {
        date_from: format(subDays(today, days), 'yyyy-MM-dd'),
        date_to: format(today, 'yyyy-MM-dd'),
    }
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                <Filter size={28} className="text-accent-cyan" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">No funnels yet</h3>
            <p className="text-slate-400 text-sm max-w-xs mb-6">
                Create your first funnel to track user journeys through your product.
            </p>
            <button
                onClick={onCreateClick}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-xl text-sm font-medium hover:bg-accent-cyan/20 transition-all"
            >
                <Plus size={15} />
                Create Funnel
            </button>
        </div>
    )
}

export default function FunnelsPage() {
    const [showModal, setShowModal] = useState(false)
    const [selectedFunnel, setSelectedFunnel] = useState<FunnelResponse | null>(null)
    const [range, setRange] = useState<DateRange>('30d')

    const { data: funnels = [], isLoading: funnelsLoading } = useQuery({
        queryKey: ['funnels'],
        queryFn: funnelsApi.list,
    })

    const { data: result, isLoading: resultLoading } = useQuery({
        queryKey: ['funnel-result', selectedFunnel?.id, range],
        queryFn: () => funnelsApi.getResult(selectedFunnel!.id, getRange(range)),
        enabled: !!selectedFunnel,
    })

    const DATE_RANGES: { label: string; value: DateRange }[] = [
        { label: '7d', value: '7d' },
        { label: '30d', value: '30d' },
        { label: '90d', value: '90d' },
    ]

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Funnels</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Track multi-step user conversion flows</p>
                </div>
                <button
                    id="create-funnel-btn"
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-xl text-sm font-medium hover:bg-accent-cyan/20 transition-all"
                >
                    <Plus size={15} />
                    New Funnel
                </button>
            </div>

            {funnelsLoading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                </div>
            ) : funnels.length === 0 ? (
                <EmptyState onCreateClick={() => setShowModal(true)} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Funnel List */}
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-1 mb-3">
                            Saved Funnels ({funnels.length})
                        </p>
                        {funnels.map((funnel) => (
                            <button
                                key={funnel.id}
                                onClick={() => setSelectedFunnel(funnel)}
                                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-150 group ${selectedFunnel?.id === funnel.id
                                    ? 'bg-cyan-500/10 border-cyan-500/30 shadow-glow-cyan'
                                    : 'bg-navy-800/50 border-white/[0.06] hover:border-white/[0.12] hover:bg-navy-800'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p
                                            className={`font-medium text-sm ${selectedFunnel?.id === funnel.id ? 'text-accent-cyan' : 'text-white'
                                                }`}
                                        >
                                            {funnel.name}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            {funnel.steps.length} steps
                                        </p>
                                    </div>
                                    <ChevronRight
                                        size={15}
                                        className={`flex-shrink-0 transition-colors ${selectedFunnel?.id === funnel.id
                                            ? 'text-accent-cyan'
                                            : 'text-slate-600 group-hover:text-slate-400'
                                            }`}
                                    />
                                </div>
                                {/* Step preview */}
                                <div className="mt-2 flex items-center gap-1 flex-wrap">
                                    {funnel.steps.slice(0, 3).map((step, i) => (
                                        <span key={i} className="text-[10px] text-slate-600 bg-navy-900 px-2 py-0.5 rounded-full">
                                            {step.event_name}
                                        </span>
                                    ))}
                                    {funnel.steps.length > 3 && (
                                        <span className="text-[10px] text-slate-600">
                                            +{funnel.steps.length - 3} more
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Funnel Result */}
                    <div className="lg:col-span-2 bg-navy-800/60 border border-white/[0.06] rounded-2xl p-6 shadow-card">
                        {!selectedFunnel ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center">
                                <Filter size={32} className="text-slate-700 mb-3" />
                                <p className="text-slate-500 text-sm">Select a funnel to view analysis</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-base font-semibold text-white">{selectedFunnel.name}</h2>
                                        <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                                            <Calendar size={11} />
                                            Funnel analysis
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-navy-900 border border-white/[0.06] rounded-lg p-0.5">
                                        {DATE_RANGES.map(({ label, value }) => (
                                            <button
                                                key={value}
                                                onClick={() => setRange(value)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${range === value
                                                    ? 'bg-cyan-500/15 text-accent-cyan'
                                                    : 'text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {resultLoading ? (
                                    <div className="flex items-center justify-center h-48">
                                        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                                    </div>
                                ) : result ? (
                                    <FunnelChart steps={result.steps} />
                                ) : (
                                    <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                                        No data for this period
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            <CreateFunnelModal open={showModal} onClose={() => setShowModal(false)} />
        </div>
    )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShieldCheck, Activity, ShieldAlert, AlertCircle } from 'lucide-react'
import { anomaliesApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { format, parseISO } from 'date-fns'
import type { AnomalyResponse } from '@/types'

// Backend accepts: info | warning | critical
type BackendSeverity = 'info' | 'warning' | 'critical'
type SeverityFilter = 'all' | BackendSeverity

const SEVERITY_COLORS: Record<BackendSeverity, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/30',
    warning: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    info: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
}

const SEVERITY_ICONS: Record<BackendSeverity, React.ReactElement> = {
    critical: <ShieldAlert size={18} className="text-red-400" />,
    warning: <AlertTriangle size={18} className="text-amber-400" />,
    info: <Activity size={18} className="text-blue-400" />,
}

export default function AnomaliesPage() {
    const queryClient = useQueryClient()
    const { showToast } = useToast()
    const workspaceId = WorkspaceStorage.get()
    const [filter, setFilter] = useState<SeverityFilter>('all')
    const [showAcknowledged, setShowAcknowledged] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['anomalies', filter, showAcknowledged, workspaceId],
        queryFn: () =>
            anomaliesApi.list(workspaceId!, {
                severity: filter === 'all' ? undefined : filter,
                unacknowledged_only: showAcknowledged ? undefined : false,
            }),
        enabled: !!workspaceId,
    })

    const { mutate: acknowledge, isPending: isAcknowledging } = useMutation({
        mutationFn: (id: string) => anomaliesApi.acknowledge(workspaceId!, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['anomalies'] })
            showToast('Anomaly acknowledged.', 'success')
        },
        onError: (err: any) => {
            if (err.response?.status === 403) {
                showToast('Action Restricted: You do not have permission to acknowledge anomalies.', 'error')
            } else {
                showToast(err.response?.data?.detail || 'Failed to acknowledge anomaly.', 'error')
            }
        }
    })

    const anomalies: AnomalyResponse[] = data?.anomalies ?? []

    return (
        <div className="space-y-6 max-w-7xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle size={24} className="text-accent-cyan" />
                        Anomaly Detection
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Automated alerts for unusual metric deviations.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-navy-800 border border-white/[0.07] rounded-xl p-2">
                    <div className="flex items-center gap-1 border-r border-white/[0.08] pr-4">
                        {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                                    filter === s
                                        ? 'bg-cyan-500/15 text-accent-cyan'
                                        : 'text-slate-500 hover:text-white'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pr-2">
                        <input
                            type="checkbox"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                            className="accent-cyan-500 cursor-pointer w-4 h-4 rounded"
                        />
                        <span className="text-xs font-medium text-slate-400 select-none">Show Acknowledged</span>
                    </label>
                </div>
            </div>

            {/* No workspace banner */}
            {!workspaceId && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center text-amber-300 text-sm">
                    Please select a workspace using the switcher in the top bar.
                </div>
            )}

            {/* Main Content Area */}
            <div className="bg-navy-800/60 border border-white/[0.06] rounded-2xl shadow-card overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                    </div>
                ) : anomalies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
                            <ShieldCheck size={32} className="text-green-400" />
                        </div>
                        <h3 className="text-white font-semibold text-lg mb-2">Systems Normal</h3>
                        <p className="text-slate-400 text-sm max-w-sm">
                            No anomalies detected matching your current filters. Looking good!
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {anomalies.map((anomaly) => (
                            <div
                                key={anomaly.id}
                                className={`p-6 transition-colors duration-200 ${
                                    anomaly.is_acknowledged ? 'bg-navy-900/40 opacity-75' : 'hover:bg-cyan-500/[0.02]'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="mt-1 flex-shrink-0">
                                            {SEVERITY_ICONS[anomaly.severity]}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-white font-semibold text-base">{anomaly.event_name}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${SEVERITY_COLORS[anomaly.severity]}`}>
                                                    {anomaly.severity}
                                                </span>
                                                {anomaly.is_acknowledged && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/10">
                                                        Acknowledged
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed mb-4">
                                                Detected abnormal <span className="text-slate-200 font-medium">{anomaly.metric}</span> on{' '}
                                                {format(parseISO(anomaly.detected_date), 'MMMM d, yyyy')}.
                                                Expected ~<span className="text-slate-200 font-medium">{Math.round(anomaly.expected_value ?? 0).toLocaleString()}</span>{' '}
                                                but actual was <span className="text-white font-bold">{anomaly.actual_value?.toLocaleString() ?? 0}</span>.
                                            </p>

                                            <div className="flex items-center gap-6">
                                                <div className="text-xs">
                                                    <span className="text-slate-500 block mb-1 uppercase tracking-wider font-semibold text-[10px]">Actual</span>
                                                    <span className="text-white font-mono">{anomaly.actual_value?.toLocaleString() ?? 0}</span>
                                                </div>
                                                <div className="h-6 w-px bg-white/10" />
                                                <div className="text-xs">
                                                    <span className="text-slate-500 block mb-1 uppercase tracking-wider font-semibold text-[10px]">Expected</span>
                                                    <span className="text-slate-300 font-mono">{Math.round(anomaly.expected_value ?? 0).toLocaleString()}</span>
                                                </div>
                                                <div className="h-6 w-px bg-white/10" />
                                                <div className="text-xs">
                                                    <span className="text-slate-500 block mb-1 uppercase tracking-wider font-semibold text-[10px]">Z-Score</span>
                                                    <span className="text-slate-300">{anomaly.z_score?.toFixed(2) ?? 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3">
                                        <span className="text-xs text-slate-500">
                                            {format(parseISO(anomaly.created_at), 'MMM d, HH:mm')}
                                        </span>
                                        {!anomaly.is_acknowledged && (
                                            <button
                                                onClick={() => acknowledge(anomaly.id)}
                                                disabled={isAcknowledging}
                                                className="flex items-center gap-2 px-4 py-2 mt-4 rounded-xl bg-navy-700/50 hover:bg-navy-600 border border-white/[0.08] hover:border-white/20 text-sm text-white font-medium transition-all group"
                                            >
                                                <ShieldCheck size={16} className="text-slate-400 group-hover:text-green-400 transition-colors" />
                                                {isAcknowledging ? 'Saving…' : 'Acknowledge'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

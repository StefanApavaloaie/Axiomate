import type { FunnelStepResult } from '@/types'

interface FunnelChartProps {
    steps: FunnelStepResult[]
}

const STEP_COLORS = ['#22d3ee', '#60a5fa', '#4ade80', '#fbbf24', '#f87171']

export default function FunnelChart({ steps }: FunnelChartProps) {
    if (!steps?.length) return null

    const maxUsers = steps[0]?.user_count ?? 1

    return (
        <div className="space-y-3">
            {steps.map((step, i) => {
                const barWidth = maxUsers > 0 ? (step.user_count / maxUsers) * 100 : 0
                const dropOff = i > 0 ? steps[i - 1].user_count - step.user_count : 0
                const color = STEP_COLORS[i % STEP_COLORS.length]

                return (
                    <div key={step.step} className="space-y-1">
                        {/* Step header */}
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-navy-950"
                                    style={{ background: color }}
                                >
                                    {step.step}
                                </div>
                                <span className="text-slate-300 font-medium">{step.event_name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                {i > 0 && (
                                    <span className="text-red-400 text-xs">
                                        −{dropOff.toLocaleString()} users
                                    </span>
                                )}
                                <span className="text-white font-semibold tabular-nums">
                                    {step.user_count.toLocaleString()}
                                </span>
                                <span className="text-slate-400 w-14 text-right font-medium">
                                    {(step.conversion_rate * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        {/* Bar */}
                        <div className="relative h-9 bg-navy-900 rounded-lg overflow-hidden">
                            <div
                                className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                                style={{
                                    width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, ${color}33, ${color}66)`,
                                    borderLeft: `3px solid ${color}`,
                                    minWidth: step.user_count > 0 ? '4px' : '0',
                                }}
                            >
                                {barWidth > 15 && (
                                    <span className="text-xs font-medium" style={{ color }}>
                                        {(step.conversion_rate * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Connector arrow between steps */}
                        {i < steps.length - 1 && (
                            <div className="flex items-center gap-2 py-1 pl-7">
                                <div className="h-4 border-l-2 border-dashed border-white/10 ml-2" />
                                <span className="text-[10px] text-slate-600">
                                    {steps[i + 1]
                                        ? `${((steps[i + 1].user_count / step.user_count) * 100).toFixed(1)}% continued`
                                        : ''}
                                </span>
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Summary */}
            {steps.length >= 2 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Overall conversion</span>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm">
                            {steps[0].user_count.toLocaleString()} → {steps[steps.length - 1].user_count.toLocaleString()}
                        </span>
                        <span className="text-xl font-bold text-accent-cyan">
                            {steps[0].user_count > 0
                                ? ((steps[steps.length - 1].user_count / steps[0].user_count) * 100).toFixed(1)
                                : '0'}%
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

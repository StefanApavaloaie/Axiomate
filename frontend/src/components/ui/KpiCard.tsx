import type { ReactNode } from 'react'

interface KpiCardProps {
    title: string
    value: number | string
    icon: ReactNode
    color?: 'cyan' | 'blue' | 'green' | 'amber'
    subtitle?: string
    isLoading?: boolean
}

const colorMap = {
    cyan: {
        bg: 'from-cyan-500/10 to-cyan-500/5',
        border: 'border-cyan-500/20',
        icon: 'bg-cyan-500/10 text-accent-cyan',
        glow: 'shadow-glow-cyan',
    },
    blue: {
        bg: 'from-blue-500/10 to-blue-500/5',
        border: 'border-blue-500/20',
        icon: 'bg-blue-500/10 text-accent-blue',
        glow: 'shadow-glow-blue',
    },
    green: {
        bg: 'from-green-500/10 to-green-500/5',
        border: 'border-green-500/20',
        icon: 'bg-green-500/10 text-accent-green',
        glow: '',
    },
    amber: {
        bg: 'from-amber-500/10 to-amber-500/5',
        border: 'border-amber-500/20',
        icon: 'bg-amber-500/10 text-accent-amber',
        glow: '',
    },
}

export default function KpiCard({
    title,
    value,
    icon,
    color = 'cyan',
    subtitle,
    isLoading = false,
}: KpiCardProps) {
    const c = colorMap[color]

    return (
        <div
            className={`relative rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} backdrop-blur-sm p-6 shadow-card overflow-hidden group hover:shadow-card-hover transition-all duration-200`}
        >
            {/* Subtle background glow */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20 bg-current" />

            <div className="relative flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-slate-400 mb-2">{title}</p>
                    {isLoading ? (
                        <div className="h-9 w-28 bg-navy-700 rounded-lg animate-pulse" />
                    ) : (
                        <p className="text-4xl font-bold text-white tracking-tight">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </p>
                    )}
                    {subtitle && (
                        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
                    )}
                </div>
                <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0 ml-4`}>
                    {icon}
                </div>
            </div>
        </div>
    )
}

import type { RetentionCohortRow } from '@/types'

interface RetentionHeatmapProps {
  cohorts: RetentionCohortRow[]
  isLoading?: boolean
}

function getBgColor(percentage: number) {
  if (percentage === 0) return 'bg-navy-800/40 text-slate-500'
  if (percentage < 10) return 'bg-cyan-900/40 text-cyan-200'
  if (percentage < 25) return 'bg-cyan-800/60 text-cyan-100'
  if (percentage < 50) return 'bg-cyan-700/80 text-white'
  if (percentage < 75) return 'bg-cyan-600 text-white font-medium'
  return 'bg-cyan-500 text-white font-bold shadow-glow-cyan'
}

export default function RetentionHeatmap({ cohorts, isLoading }: RetentionHeatmapProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="w-24 h-8 bg-navy-800 rounded animate-pulse" />
            <div className="flex-1 flex gap-2">
              {[...Array(8)].map((_, j) => (
                <div key={j} className="w-12 h-8 bg-navy-800 rounded animate-pulse" style={{ opacity: Math.max(0.1, 1 - j * 0.15) }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!cohorts?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No retention data available for this period.
      </div>
    )
  }

  const maxDays = Math.max(...cohorts.map((c) => c.periods.length))

  return (
    <div className="overflow-x-auto pb-4 custom-scrollbar">
      <div className="min-w-[800px]">
        {/* Header Row */}
        <div className="flex gap-1 mb-2">
          <div className="w-28 flex-shrink-0 text-xs font-semibold text-slate-500 px-2 py-1">
            Cohort
          </div>
          <div className="w-16 flex-shrink-0 text-xs font-semibold text-slate-500 px-2 py-1 text-center">
            Users
          </div>
          <div className="flex-1 flex gap-1">
            {[...Array(maxDays)].map((_, i) => (
              <div key={i} className="w-12 flex-shrink-0 text-xs font-semibold text-slate-500 text-center py-1">
                Day {i}
              </div>
            ))}
          </div>
        </div>

        {/* Data Rows */}
        <div className="space-y-1">
          {cohorts.map((cohort, index) => (
            <div key={index} className="flex gap-1 group">
              {/* Date */}
              <div className="w-28 flex-shrink-0 text-xs font-medium text-slate-300 px-2 py-2 flex items-center border border-white/[0.04] rounded bg-navy-800/50 group-hover:bg-navy-800 transition-colors">
                {cohort.cohort_date}
              </div>
              {/* Total Users */}
              <div className="w-16 flex-shrink-0 text-xs font-semibold text-white px-2 py-2 flex items-center justify-center border border-white/[0.04] rounded bg-navy-800/50 group-hover:bg-navy-800 transition-colors tabular-nums">
                {cohort.initial_users.toLocaleString()}
              </div>

              {/* Heatmap Cells */}
              <div className="flex-1 flex gap-1">
                {cohort.periods.map((periodObj, dayIndex) => {
                  const percent = periodObj.retention_rate * 100
                  return (
                    <div
                      key={dayIndex}
                      className={`
                        w-12 flex-shrink-0 rounded flex items-center justify-center text-[11px] tabular-nums
                        transition-all duration-300 border border-white/[0.05]
                        ${getBgColor(percent)}
                      `}
                      title={`Day ${dayIndex}: ${percent.toFixed(1)}% retention`}
                    >
                      {percent > 0 ? `${Math.round(percent)}%` : '-'}
                    </div>
                  )
                })}
                
                {/* Empty padding for newer cohorts that haven't reached maxDays yet */}
                {[...Array(maxDays - cohort.periods.length)].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-12 flex-shrink-0 rounded bg-navy-900/50 border border-transparent"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.5);
        }
      `}</style>
    </div>
  )
}

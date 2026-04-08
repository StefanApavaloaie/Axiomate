import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'
import { format, subDays } from 'date-fns'

export type DateRange = '7d' | '30d' | '90d'

export function getDateRange(range: DateRange) {
    const today = new Date()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    return {
        date_from: format(subDays(today, days), 'yyyy-MM-dd'),
        date_to: format(today, 'yyyy-MM-dd'),
    }
}

export function useOverview(range: DateRange) {
    const workspaceId = WorkspaceStorage.get()
    const params = getDateRange(range)
    return useQuery({
        queryKey: ['dashboard', 'overview', range, workspaceId],
        queryFn: () => dashboardApi.getOverview(workspaceId!, params),
        enabled: !!workspaceId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useEventBreakdown(range: DateRange) {
    const workspaceId = WorkspaceStorage.get()
    const params = getDateRange(range)
    return useQuery({
        queryKey: ['dashboard', 'breakdown', range, workspaceId],
        queryFn: () => dashboardApi.getEventBreakdown(workspaceId!, params),
        enabled: !!workspaceId,
        staleTime: 5 * 60 * 1000,
    })
}

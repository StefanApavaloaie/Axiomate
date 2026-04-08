import { apiClient } from './client'
import type {
    OverviewResponse,
    EventBreakdownResponse,
    FunnelCreate,
    FunnelResponse,
    FunnelResultResponse,
    RetentionApiResponse,
    AnomalyListResponse,
    AiApiResponse,
    SavedQueryCreate,
    SavedQueryResponse,
    WorkspaceResponse,
    WorkspaceCreate,
    ApiKeyResponse,
    ApiKeyCreatedResponse,
    ApiKeyCreate,
    UserProfile,
    DateRangeParams,
} from '@/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
    getMe: () => apiClient.get<UserProfile>('/auth/me').then((r) => r.data),
    refresh: (refreshToken: string) =>
        apiClient
            .post<{ access_token: string }>('/auth/refresh', {
                refresh_token: refreshToken,
            })
            .then((r) => r.data),
    getGoogleLoginUrl: () => `http://localhost:8000/api/v1/auth/google`,
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspacesApi = {
    list: () =>
        apiClient.get<WorkspaceResponse[]>('/workspaces/').then((r) => r.data),
    create: (data: WorkspaceCreate) =>
        apiClient.post<WorkspaceResponse>('/workspaces/', data).then((r) => r.data),
    getById: (id: string) =>
        apiClient.get<WorkspaceResponse>(`/workspaces/${id}`).then((r) => r.data),
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
    getOverview: (workspaceId: string, params: DateRangeParams) =>
        apiClient
            .get<OverviewResponse>(`/dashboards/${workspaceId}/overview`, { params })
            .then((r) => r.data),
    getEventBreakdown: (workspaceId: string, params: DateRangeParams) =>
        apiClient
            .get<EventBreakdownResponse>(`/dashboards/${workspaceId}/event-breakdown`, { params })
            .then((r) => r.data),
}

// ─── Funnels ──────────────────────────────────────────────────────────────────
export const funnelsApi = {
    list: (workspaceId: string) =>
        apiClient.get<FunnelResponse[]>(`/funnels/${workspaceId}`).then((r) => r.data),
    create: (workspaceId: string, data: FunnelCreate) =>
        apiClient.post<FunnelResponse>(`/funnels/${workspaceId}`, data).then((r) => r.data),
    getResult: (workspaceId: string, funnelId: string, params: DateRangeParams) =>
        apiClient
            .get<FunnelResultResponse>(`/funnels/${workspaceId}/${funnelId}/results`, { params })
            .then((r) => r.data),
}

// ─── Retention ────────────────────────────────────────────────────────────────
export const retentionApi = {
    get: (
        workspaceId: string,
        params: {
            date_from: string
            date_to: string
            initial_event: string
            return_event: string
            granularity?: string
        }
    ) =>
        apiClient
            .get<RetentionApiResponse>(`/retention/${workspaceId}`, { params })
            .then((r) => r.data),
}

// ─── Anomalies ────────────────────────────────────────────────────────────────
export const anomaliesApi = {
    list: (
        workspaceId: string,
        params?: { severity?: string; unacknowledged_only?: boolean }
    ) =>
        apiClient
            .get<AnomalyListResponse>(`/anomalies/${workspaceId}`, { params })
            .then((r) => r.data),
    acknowledge: (workspaceId: string, id: string) =>
        apiClient.patch(`/anomalies/${workspaceId}/${id}/acknowledge`).then((r) => r.data),
}

// ─── AI Copilot ───────────────────────────────────────────────────────────────
export const aiApi = {
    query: (workspaceId: string, question: string) =>
        apiClient
            .post<AiApiResponse>('/ai/query', {
                question,
                workspace_id: workspaceId,
            })
            .then((r) => r.data),
    listSavedQueries: () =>
        apiClient
            .get<SavedQueryResponse[]>('/ai/saved-queries')
            .then((r) => r.data),
    saveQuery: (data: SavedQueryCreate) =>
        apiClient
            .post<SavedQueryResponse>('/ai/saved-queries', data)
            .then((r) => r.data),
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export const apiKeysApi = {
    list: () =>
        apiClient.get<ApiKeyResponse[]>('/api-keys/').then((r) => r.data),
    create: (data: ApiKeyCreate) =>
        apiClient
            .post<ApiKeyCreatedResponse>('/api-keys/', data)
            .then((r) => r.data),
    revoke: (id: string) =>
        apiClient.delete(`/api-keys/${id}`).then((r) => r.data),
}

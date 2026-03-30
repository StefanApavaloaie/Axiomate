import { apiClient } from './client'
import type {
    OverviewResponse,
    EventBreakdownResponse,
    FunnelCreate,
    FunnelResponse,
    FunnelResultResponse,
    RetentionResponse,
    AnomalyListResponse,
    AiQueryRequest,
    AiQueryResponse,
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
    getOverview: (params: DateRangeParams) =>
        apiClient
            .get<OverviewResponse>('/dashboards/overview', { params })
            .then((r) => r.data),
    getEventBreakdown: (params: DateRangeParams) =>
        apiClient
            .get<EventBreakdownResponse>('/dashboards/events/breakdown', { params })
            .then((r) => r.data),
}

// ─── Funnels ──────────────────────────────────────────────────────────────────
export const funnelsApi = {
    list: () =>
        apiClient.get<FunnelResponse[]>('/funnels/').then((r) => r.data),
    create: (data: FunnelCreate) =>
        apiClient.post<FunnelResponse>('/funnels/', data).then((r) => r.data),
    getResult: (id: string, params: DateRangeParams) =>
        apiClient
            .get<FunnelResultResponse>(`/funnels/${id}/result`, { params })
            .then((r) => r.data),
}

// ─── Retention ────────────────────────────────────────────────────────────────
export const retentionApi = {
    get: (params: {
        date_from: string
        date_to: string
        granularity?: string
        initial_event?: string
        return_event?: string
    }) =>
        apiClient
            .get<RetentionResponse>('/retention/', { params })
            .then((r) => r.data),
}

// ─── Anomalies ────────────────────────────────────────────────────────────────
export const anomaliesApi = {
    list: (params?: { severity?: string; acknowledged?: boolean }) =>
        apiClient
            .get<AnomalyListResponse>('/anomalies/', { params })
            .then((r) => r.data),
    acknowledge: (id: string) =>
        apiClient.patch(`/anomalies/${id}/acknowledge`).then((r) => r.data),
}

// ─── AI Copilot ───────────────────────────────────────────────────────────────
export const aiApi = {
    query: (data: AiQueryRequest) =>
        apiClient.post<AiQueryResponse>('/ai/query', data).then((r) => r.data),
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

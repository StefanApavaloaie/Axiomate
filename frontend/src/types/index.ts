// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface TokenResponse {
    access_token: string
}

export interface GoogleCallbackResponse {
    access_token: string
    refresh_token: string
}

export interface RefreshTokenRequest {
    refresh_token: string
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface UserProfile {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
}

// ─── Workspace ────────────────────────────────────────────────────────────────
export interface WorkspaceResponse {
    id: string
    name: string
    slug: string
    created_at: string
}

export interface WorkspaceCreate {
    name: string
    slug: string
}

export interface WorkspaceMemberResponse {
    id: string
    user_id: string
    workspace_id: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    created_at: string
}

export interface InviteMemberRequest {
    email: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DailyMetricPoint {
    date: string
    event_count: number
    unique_users: number
}

export interface OverviewResponse {
    date_from: string
    date_to: string
    total_events: number
    total_unique_users: number
    daily_series: DailyMetricPoint[]
}

export interface EventBreakdownItem {
    event_name: string
    total_count: number
    unique_users: number
}

export interface EventBreakdownResponse {
    date_from: string
    date_to: string
    events: EventBreakdownItem[]
}

// ─── Funnels ──────────────────────────────────────────────────────────────────
export interface FunnelStep {
    step: number
    event_name: string
    filters: Record<string, unknown>
}

export interface FunnelCreate {
    name: string
    steps: FunnelStep[]
}

export interface FunnelResponse {
    id: string
    name: string
    steps: FunnelStep[]
    created_at: string
}

export interface FunnelStepResult {
    step: number
    event_name: string
    user_count: number
    conversion_rate: number // 0.0 to 1.0
}

export interface FunnelResultResponse {
    funnel_id: string
    date_from: string
    date_to: string
    steps: FunnelStepResult[]
    computed_at: string
}

// ─── Retention ────────────────────────────────────────────────────────────────
export interface RetentionPeriod {
    period: number
    users: number
    retention_rate: number // 0.0 to 1.0
}

export interface RetentionCohortRow {
    cohort_date: string
    initial_users: number
    periods: RetentionPeriod[]
}

export interface RetentionResponse {
    granularity: string
    initial_event: string
    return_event: string
    cohorts: RetentionCohortRow[]
    computed_at: string
}

// ─── Anomalies ────────────────────────────────────────────────────────────────
export interface AnomalyResponse {
    id: string
    event_name: string
    detected_date: string
    metric: string
    expected_value: number | null
    actual_value: number | null
    z_score: number | null
    severity: 'low' | 'medium' | 'high' | 'critical'
    is_acknowledged: boolean
    created_at: string
}

export interface AnomalyListResponse {
    anomalies: AnomalyResponse[]
    total: number
}

// ─── Reports ─────────────────────────────────────────────────────────────────
export interface ReportCreate {
    name: string
    config: Record<string, unknown>
}

export interface ReportResponse {
    id: string
    name: string
    config: Record<string, unknown>
    created_at: string
}

// ─── AI / Ollama ──────────────────────────────────────────────────────────────
export interface AiQueryRequest {
    question: string
}

export interface AiQueryResponse {
    id: string
    question: string
    llm_response: string
    model_used: string
    latency_ms: number
    created_at: string
}

export interface SavedQueryCreate {
    name: string
    question: string
    last_response?: string | null
}

export interface SavedQueryResponse {
    id: string
    name: string
    question: string
    last_response: string | null
    created_at: string
}

// ─── API Keys ─────────────────────────────────────────────────────────────────
export interface ApiKeyResponse {
    id: string
    name: string
    prefix: string
    is_active: boolean
    created_at: string
}

export interface ApiKeyCreatedResponse {
    id: string
    name: string
    prefix: string
    raw_key: string  // Only returned once on creation
    is_active: boolean
    created_at: string
}

export interface ApiKeyCreate {
    name: string
}

// ─── Generic / Utility ────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    size: number
}

export type DateRangeParams = {
    date_from: string  // YYYY-MM-DD
    date_to: string    // YYYY-MM-DD
}

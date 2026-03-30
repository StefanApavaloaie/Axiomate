import axios, { AxiosError } from 'axios'

const BASE_URL = 'http://localhost:8000/api/v1'

// ─── Token helpers ────────────────────────────────────────────────────────────
export const TokenStorage = {
    getAccess: (): string | null => localStorage.getItem('axiomate_access_token'),
    getRefresh: (): string | null => localStorage.getItem('axiomate_refresh_token'),
    setTokens: (access: string, refresh?: string) => {
        localStorage.setItem('axiomate_access_token', access)
        if (refresh) localStorage.setItem('axiomate_refresh_token', refresh)
    },
    clear: () => {
        localStorage.removeItem('axiomate_access_token')
        localStorage.removeItem('axiomate_refresh_token')
        localStorage.removeItem('axiomate_workspace_id')
    },
}

export const WorkspaceStorage = {
    get: (): string | null => localStorage.getItem('axiomate_workspace_id'),
    set: (id: string) => localStorage.setItem('axiomate_workspace_id', id),
    clear: () => localStorage.removeItem('axiomate_workspace_id'),
}

// ─── Axios instance ───────────────────────────────────────────────────────────
export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
})

// ─── Request interceptor — inject JWT + Workspace header ─────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token = TokenStorage.getAccess()
        if (token) {
            config.headers.set('Authorization', `Bearer ${token}`)
        }
        const workspaceId = WorkspaceStorage.get()
        if (workspaceId) {
            config.headers.set('X-Workspace-ID', workspaceId)
        }
        return config
    },
    (error) => Promise.reject(error)
)

// ─── Response interceptor — handle 401 auto-refresh + 403 logout ─────────────
let isRefreshing = false
let failedQueue: Array<{
    resolve: (token: string) => void
    reject: (err: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null) => {
    failedQueue.forEach((p) => {
        if (error) p.reject(error)
        else p.resolve(token!)
    })
    failedQueue = []
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalRequest = error.config as any

        // 403 Forbidden → clear session, redirect to login
        if (error.response?.status === 403) {
            TokenStorage.clear()
            window.location.href = '/login'
            return Promise.reject(error)
        }

        // 401 Unauthorized → attempt token refresh
        if (error.response?.status === 401 && !originalRequest?._retry) {
            const refreshToken = TokenStorage.getRefresh()

            if (!refreshToken) {
                TokenStorage.clear()
                window.location.href = '/login'
                return Promise.reject(error)
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                }).then((token) => {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`
                    return apiClient(originalRequest)
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
                    refresh_token: refreshToken,
                })
                const newAccessToken: string = data.access_token
                TokenStorage.setTokens(newAccessToken)
                processQueue(null, newAccessToken)
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
                return apiClient(originalRequest)
            } catch (refreshError) {
                processQueue(refreshError, null)
                TokenStorage.clear()
                window.location.href = '/login'
                return Promise.reject(refreshError)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

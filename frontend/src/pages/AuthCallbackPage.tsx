import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { TokenStorage } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import type { GoogleCallbackResponse } from '@/types'

export default function AuthCallbackPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { setUser } = useAuth()
    const hasRun = useRef(false)

    useEffect(() => {
        // Prevent double-execution in React StrictMode
        if (hasRun.current) return
        hasRun.current = true

        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error || !code) {
            navigate('/login?error=oauth_failed', { replace: true })
            return
        }

        // Exchange the code via the backend
        apiClient
            .get<GoogleCallbackResponse>('/auth/google/callback', { params: { code } })
            .then((res) => {
                const { access_token, refresh_token } = res.data
                TokenStorage.setTokens(access_token, refresh_token)

                // Fetch current user profile and put it in context
                return apiClient.get('/auth/me', {
                    headers: { Authorization: `Bearer ${access_token}` },
                })
            })
            .then((res) => {
                setUser(res.data)
                navigate('/dashboard', { replace: true })
            })
            .catch(() => {
                navigate('/login?error=auth_failed', { replace: true })
            })
    }, [searchParams, navigate, setUser])

    return (
        <div className="min-h-screen bg-navy-950 flex items-center justify-center">
            <div className="text-center animate-fade-in">
                {/* Spinning loader */}
                <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-cyan animate-spin" />
                    <div className="absolute inset-2 rounded-full border border-transparent border-t-blue-400/50 animate-spin" style={{ animationDuration: '1.5s' }} />
                </div>
                <h2 className="text-white font-semibold text-lg">Signing you in…</h2>
                <p className="text-slate-400 text-sm mt-1">Verifying your credentials</p>
            </div>
        </div>
    )
}

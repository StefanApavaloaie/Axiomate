import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api'
import { useAuth } from '@/hooks/useAuth'

function GoogleIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
            </g>
        </svg>
    )
}

export default function LoginPage() {
    const navigate = useNavigate()
    const { isAuthenticated, isLoading } = useAuth()

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate('/dashboard', { replace: true })
        }
    }, [isAuthenticated, isLoading, navigate])

    const handleGoogleLogin = () => {
        window.location.href = authApi.getGoogleLoginUrl()
    }

    return (
        <div className="min-h-screen bg-navy-950 flex items-center justify-center relative overflow-hidden">
            {/* Background glow effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-3xl" />
            </div>

            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Login card */}
            <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/20 mb-6 shadow-glow-cyan">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                            <path d="M16 4L28 26H4L16 4Z" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M16 4L24 20" stroke="#60a5fa" strokeWidth="1.5" />
                            <circle cx="24" cy="14" r="3" fill="#22d3ee" opacity="0.8" />
                            <path d="M8 22L20 10" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="2 2" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Axiomate
                    </h1>
                    <p className="mt-2 text-slate-400 text-sm">
                        Product Analytics Platform
                    </p>
                </div>

                {/* Card */}
                <div className="bg-navy-800/80 backdrop-blur-sm border border-white/[0.07] rounded-2xl p-8 shadow-card">
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-semibold text-white">Welcome back</h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Sign in to access your analytics workspace
                        </p>
                    </div>

                    {/* Google Sign In Button */}
                    <button
                        id="google-signin-btn"
                        onClick={handleGoogleLogin}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="mt-6 flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/[0.07]" />
                        <span className="text-slate-600 text-xs">Secure OAuth 2.0</span>
                        <div className="flex-1 h-px bg-white/[0.07]" />
                    </div>

                    {/* Features list */}
                    <div className="mt-6 space-y-2">
                        {[
                            'Funnel & Retention Analytics',
                            'AI-Powered Anomaly Detection',
                            'Real-time Event Tracking',
                        ].map((feature) => (
                            <div key={feature} className="flex items-center gap-2 text-slate-400 text-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan flex-shrink-0" />
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-center text-slate-600 text-xs mt-6">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    )
}

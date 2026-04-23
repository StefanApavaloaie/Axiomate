import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  init as sentryInit,
  browserTracingIntegration,
  replayIntegration,
  ErrorBoundary as SentryErrorBoundary,
} from '@sentry/react'
import { AuthProvider } from '@/providers/AuthProvider'
import { ToastProvider } from '@/context/ToastContext'
import App from './App.tsx'
import './index.css'

// ── Sentry (frontend error tracking) ─────────────────────────────────────────
// Only activates when VITE_SENTRY_DSN is set in the environment.
// Add it to frontend/.env as: VITE_SENTRY_DSN=https://xxx@sentry.io/yyy
if (import.meta.env.VITE_SENTRY_DSN) {
  console.log('🚀 Sentry: Initializing error tracking...')
  sentryInit({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,     // "production" | "development"
    integrations: [
      browserTracingIntegration(),
      replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.2,           // Profile 20% of requests for perf data
    replaysSessionSampleRate: 0.05,  // Record 5% of all sessions
    replaysOnErrorSampleRate: 1.0,   // Always record a session when error occurs
  })
  console.log('✅ Sentry: Active — errors will be reported to your dashboard')
} else {
  console.warn('⚠️ Sentry DSN not found — error tracking disabled.')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: '12px',
          background: '#0f1117', color: '#e2e8f0', fontFamily: 'sans-serif',
        }}>
          <h2 style={{ color: '#f87171', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Our team has been notified. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px', padding: '10px 24px', borderRadius: '8px',
              background: '#6366f1', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: '14px',
            }}
          >
            Refresh
          </button>
        </div>
      }
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </SentryErrorBoundary>
  </StrictMode>
)

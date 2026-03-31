import { NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Filter,
    RefreshCw,
    AlertTriangle,
    Sparkles,
    Settings,
    ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/funnels', label: 'Funnels', icon: Filter },
    { path: '/retention', label: 'Retention', icon: RefreshCw },
    { path: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
    { path: '/ai', label: 'AI Copilot', icon: Sparkles },
]

export default function Sidebar() {
    const location = useLocation()
    const { user, logout } = useAuth()

    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-navy-900 border-r border-white/[0.05] flex flex-col z-40">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-white/[0.05]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/20 flex items-center justify-center flex-shrink-0 shadow-glow-cyan">
                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                            <path d="M16 4L28 26H4L16 4Z" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M16 4L24 20" stroke="#60a5fa" strokeWidth="1.5" />
                            <circle cx="24" cy="14" r="3" fill="#22d3ee" opacity="0.8" />
                            <path d="M8 22L20 10" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="2 2" />
                        </svg>
                    </div>
                    <div>
                        <span className="font-bold text-white text-sm tracking-wide">Axiomate</span>
                        <p className="text-[10px] text-slate-500 leading-none mt-0.5">Analytics Platform</p>
                    </div>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
                    Analytics
                </p>
                {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                    const isActive = location.pathname === path
                    return (
                        <NavLink
                            key={path}
                            to={path}
                            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
                            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive
                                    ? 'bg-cyan-500/10 text-accent-cyan border border-cyan-500/20 shadow-glow-cyan'
                                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                                }
              `}
                        >
                            <Icon
                                size={17}
                                className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent-cyan' : 'text-slate-500 group-hover:text-slate-300'}`}
                            />
                            <span className="flex-1">{label}</span>
                            {isActive && <ChevronRight size={14} className="text-cyan-400/50" />}
                        </NavLink>
                    )
                })}

                <div className="pt-4">
                    <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
                        Configuration
                    </p>
                    <NavLink
                        to="/settings"
                        id="nav-settings"
                        className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
              ${location.pathname === '/settings'
                                ? 'bg-cyan-500/10 text-accent-cyan border border-cyan-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                            }
            `}
                    >
                        <Settings size={17} className="flex-shrink-0 text-slate-500 group-hover:text-slate-300" />
                        Settings
                    </NavLink>
                </div>
            </nav>

            {/* User profile at bottom */}
            <div className="px-3 py-4 border-t border-white/[0.05]">
                <button
                    id="sidebar-logout-btn"
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-150 group text-left"
                >
                    {user?.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt={user.name ?? 'User'}
                            className="w-8 h-8 rounded-full ring-2 ring-white/10 flex-shrink-0"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user?.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-300 truncate group-hover:text-white transition-colors">
                            {user?.name ?? 'User'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                </button>
            </div>
        </aside>
    )
}

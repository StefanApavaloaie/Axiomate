import { Bell, LogOut } from 'lucide-react'
import WorkspaceSwitcher from '@/components/shared/WorkspaceSwitcher'
import { useAuth } from '@/hooks/useAuth'

export default function TopBar() {
    const { user, logout } = useAuth()

    return (
        <header className="fixed top-0 left-64 right-0 h-14 bg-navy-950/80 backdrop-blur-md border-b border-white/[0.05] flex items-center justify-between px-6 z-30">
            {/* Left: Workspace Switcher */}
            <WorkspaceSwitcher />

            {/* Right: actions + avatar */}
            <div className="flex items-center gap-3">
                {/* Notification bell */}
                <button
                    id="topbar-notifications-btn"
                    className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all duration-150"
                >
                    <Bell size={16} />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-cyan" />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/[0.08]" />

                {/* User avatar + name */}
                <div className="flex items-center gap-2.5">
                    {user?.avatar_url ? (
                        <img
                            src={user.avatar_url}
                            alt={user.name ?? 'User'}
                            className="w-7 h-7 rounded-full ring-2 ring-white/10"
                        />
                    ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                            {user?.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                    )}
                    <span className="text-sm text-slate-300 font-medium hidden sm:block">
                        {user?.name?.split(' ')[0]}
                    </span>
                </div>

                {/* Logout */}
                <button
                    id="topbar-logout-btn"
                    onClick={logout}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/[0.08] transition-all duration-150"
                    title="Sign out"
                >
                    <LogOut size={15} />
                </button>
            </div>
        </header>
    )
}

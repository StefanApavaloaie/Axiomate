import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Building2, Check, Plus } from 'lucide-react'
import { workspacesApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'

export default function WorkspaceSwitcher() {
    const [open, setOpen] = useState(false)

    const { data: workspaces = [] } = useQuery({
        queryKey: ['workspaces'],
        queryFn: workspacesApi.list,
    })

    const currentId = WorkspaceStorage.get()
    const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0]

    const selectWorkspace = (id: string) => {
        WorkspaceStorage.set(id)
        setOpen(false)
        window.location.reload()
    }

    return (
        <div className="relative">
            <button
                id="workspace-switcher-btn"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-800 border border-white/[0.07] hover:border-white/[0.12] transition-all duration-150 text-sm"
            >
                <div className="w-5 h-5 rounded bg-gradient-to-br from-cyan-400/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <Building2 size={11} className="text-accent-cyan" />
                </div>
                <span className="text-slate-200 font-medium max-w-[120px] truncate">
                    {current?.name ?? 'Select Workspace'}
                </span>
                <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-56 bg-navy-800 border border-white/[0.07] rounded-xl shadow-card z-50 overflow-hidden animate-fade-in">
                        <div className="px-3 py-2 border-b border-white/[0.05]">
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                Workspaces
                            </p>
                        </div>
                        <ul className="py-1 max-h-48 overflow-y-auto">
                            {workspaces.map((ws) => (
                                <li key={ws.id}>
                                    <button
                                        onClick={() => selectWorkspace(ws.id)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition-colors text-sm text-left"
                                    >
                                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center text-[10px] font-bold text-accent-cyan flex-shrink-0">
                                            {ws.name[0]?.toUpperCase()}
                                        </div>
                                        <span className="flex-1 text-slate-300 truncate">{ws.name}</span>
                                        {ws.id === current?.id && (
                                            <Check size={13} className="text-accent-cyan flex-shrink-0" />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-white/[0.05] p-1">
                            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-sm text-slate-400 hover:text-white transition-colors">
                                <Plus size={13} />
                                Create workspace
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

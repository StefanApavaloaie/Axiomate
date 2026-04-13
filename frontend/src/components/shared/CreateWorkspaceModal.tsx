import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, X, Loader2 } from 'lucide-react'
import { workspacesApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'

interface CreateWorkspaceModalProps {
    open: boolean
    onClose: () => void
}

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .slice(0, 48)
}

export default function CreateWorkspaceModal({ open, onClose }: CreateWorkspaceModalProps) {
    const queryClient = useQueryClient()
    const [name, setName] = useState('')
    const [apiError, setApiError] = useState<string | null>(null)

    const slug = slugify(name)

    const { mutate, isPending } = useMutation({
        mutationFn: () => workspacesApi.create({ name: name.trim(), slug }),
        onSuccess: (workspace) => {
            WorkspaceStorage.set(workspace.id)
            queryClient.invalidateQueries({ queryKey: ['workspaces'] })
            setName('')
            setApiError(null)
            onClose()
            window.location.reload()
        },
        onError: (err: { response?: { data?: { detail?: string } } }) => {
            const detail = err?.response?.data?.detail ?? 'Failed to create workspace.'
            setApiError(detail)
        },
    })

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim() || isPending) return
        setApiError(null)
        mutate()
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-navy-800 border border-white/[0.08] rounded-2xl shadow-card-hover animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center">
                            <Building2 size={18} className="text-accent-cyan" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white">Create Workspace</h2>
                            <p className="text-slate-400 text-xs">Set up a new analytics workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            Workspace Name
                        </label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                setApiError(null)
                            }}
                            placeholder="e.g. My Product, Acme Corp"
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                        {name.trim() && (
                            <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                                Slug:
                                <span className="font-mono text-slate-400 bg-navy-900 px-1.5 py-0.5 rounded ml-1">
                                    {slug}
                                </span>
                            </p>
                        )}
                    </div>

                    {apiError && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                            {apiError}
                        </p>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim() || isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 text-sm font-medium transition-all disabled:opacity-50"
                        >
                            {isPending ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Building2 size={14} />
                            )}
                            {isPending ? 'Creating…' : 'Create Workspace'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

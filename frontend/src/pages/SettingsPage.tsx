import { useState, useEffect, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Settings,
    Key,
    Users,
    Copy,
    Trash2,
    Plus,
    Check,
    Loader2,
    Eye,
    EyeOff,
    Building2,
    Shield,
    AlertTriangle,
    X,
    Save,
    Fingerprint,
    Mail,
    ChevronRight,
} from 'lucide-react'
import { workspacesApi, apiKeysApi, authApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import type { ApiKeyCreatedResponse, ApiKeyResponse, WorkspaceMemberWithUser, WorkspaceResponse } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    admin: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    member: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    viewer: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider border ${ROLE_COLORS[role] ?? ROLE_COLORS.member}`}>
            {role}
        </span>
    )
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button
            onClick={copy}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
            title="Copy"
        >
            {copied ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
        </button>
    )
}

// ─── New Key Modal ────────────────────────────────────────────────────────────
function NewKeyModal({
    workspaceId,
    onClose,
    onCreated,
}: {
    workspaceId: string
    onClose: () => void
    onCreated: (key: ApiKeyCreatedResponse) => void
}) {
    const [name, setName] = useState('')
    const [error, setError] = useState<string | null>(null)

    const { mutate, isPending } = useMutation({
        mutationFn: () => apiKeysApi.create(workspaceId, { name: name.trim() }),
        onSuccess: onCreated,
        onError: () => setError('Failed to create key. Try again.'),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-navy-800 border border-white/[0.08] rounded-2xl shadow-card-hover animate-fade-in">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                        <Key size={16} className="text-accent-cyan" />
                        <h3 className="text-sm font-semibold text-white">New API Key</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={15} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Key Name</label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Production SDK, CI Pipeline"
                            className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutate()}
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => mutate()}
                            disabled={!name.trim() || isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 text-sm font-medium transition-all disabled:opacity-40"
                        >
                            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {isPending ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Revealed Key Modal ───────────────────────────────────────────────────────
function RevealedKeyModal({ apiKey, onClose }: { apiKey: ApiKeyCreatedResponse; onClose: () => void }) {
    const [visible, setVisible] = useState(false)
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(apiKey.raw_key)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg bg-navy-800 border border-white/[0.08] rounded-2xl shadow-card-hover animate-fade-in">
                <div className="px-6 py-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                            <AlertTriangle size={15} className="text-amber-400" />
                        </div>
                        <h3 className="font-semibold text-white">Save your API key now</h3>
                    </div>
                    <p className="text-slate-400 text-sm">
                        This key is only shown <strong className="text-white">once</strong>. Copy it before closing.
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative bg-navy-900 border border-white/[0.08] rounded-xl p-4">
                        <p className="font-mono text-sm text-cyan-300 break-all pr-14">
                            {visible ? apiKey.raw_key : '•'.repeat(Math.min(apiKey.raw_key.length, 52))}
                        </p>
                        <div className="absolute top-3 right-3 flex items-center gap-1">
                            <button
                                onClick={() => setVisible(!visible)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
                            >
                                {visible ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <CopyButton text={apiKey.raw_key} />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={copy}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 text-sm font-medium transition-all"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'Copied!' : 'Copy Key'}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-all"
                        >
                            I've saved it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Tab: General ─────────────────────────────────────────────────────────────
function GeneralTab({ workspaceId }: { workspaceId: string }) {
    const queryClient = useQueryClient()
    const { showToast } = useToast()
    const { data: workspace, isLoading } = useQuery({
        queryKey: ['workspace', workspaceId],
        queryFn: () => workspacesApi.getById(workspaceId),
        enabled: !!workspaceId,
    })
    
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    
    // Initialize exactly once when workspace loads
    useEffect(() => {
        if (workspace && !name) {
            setName(workspace.name)
            setSlug(workspace.slug)
        }
    }, [workspace])

    const { mutate: updateWorkspace, isPending: isUpdating } = useMutation({
        mutationFn: () => workspacesApi.update(workspaceId, { name: name.trim(), slug }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
            queryClient.invalidateQueries({ queryKey: ['workspaces'] }) // Refresh global list
            showToast('Workspace settings saved.', 'success')
        },
        onError: (err: any) => {
            if (err.response?.status === 403) {
                showToast('Action Restricted: You do not have permission to change these settings.', 'error')
            } else {
                showToast(err.response?.data?.detail || 'Failed to update workspace.', 'error')
            }
        }
    })

    const { mutate: deleteWorkspace, isPending: isDeleting } = useMutation({
        mutationFn: () => workspacesApi.delete(workspaceId),
        onSuccess: () => {
            WorkspaceStorage.clear()
            window.location.reload()
        }
    })

    if (isLoading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-2xl bg-navy-800" />
            <div className="h-64 rounded-2xl bg-navy-800" />
        </div>
    }

    return (
        <div className="space-y-6">
            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Workspace Identity</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Workspace Name</label>
                        <input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
                            }}
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Slug (URL snippet)</label>
                        <input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono text-sm"
                        />
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={() => updateWorkspace()}
                            disabled={isUpdating || !name.trim() || (name === workspace?.name && slug === workspace?.slug)}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-navy-950 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl divide-y divide-white/[0.05]">
                <div className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm font-medium text-slate-400">Workspace ID</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-200">{workspaceId}</span>
                        <CopyButton text={workspaceId} />
                    </div>
                </div>
                <div className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm font-medium text-slate-400">Ingest API Endpoint</span>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-200">http://localhost:8000/api/v1/ingest/</span>
                        <CopyButton text={`http://localhost:8000/api/v1/ingest/`} />
                    </div>
                </div>
            </div>

            <div className="bg-red-500/[0.03] border border-red-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
                <p className="text-sm text-slate-400 mb-5">
                    Deleting the workspace restricts all access immediately and hides ingested data. This action triggers a soft-delete and can be undone manually by a database administrator within 30 days.
                </p>
                <button
                    onClick={() => {
                        if (confirm(`Are you absolutely sure you want to delete ${workspace?.name}?`)) deleteWorkspace()
                    }}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium transition-all"
                >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    Delete Workspace
                </button>
            </div>
        </div>
    )
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────
function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
    const queryClient = useQueryClient()
    const [showNewModal, setShowNewModal] = useState(false)
    const [revealedKey, setRevealedKey] = useState<ApiKeyCreatedResponse | null>(null)
    const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)

    const { data: keys = [], isLoading } = useQuery({
        queryKey: ['api-keys', workspaceId],
        queryFn: () => apiKeysApi.list(workspaceId),
        enabled: !!workspaceId,
    })

    const { mutate: revoke, isPending: revoking } = useMutation({
        mutationFn: (keyId: string) => apiKeysApi.revoke(workspaceId, keyId),
        onSuccess: () => {
            setRevokeConfirm(null)
            queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] })
        },
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    API keys authenticate your SDK calls to the ingest endpoint.
                </p>
                <button
                    id="new-api-key-btn"
                    onClick={() => setShowNewModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-xl text-sm font-medium hover:bg-accent-cyan/20 transition-all"
                >
                    <Plus size={14} />
                    New Key
                </button>
            </div>

            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Loading keys…</div>
                ) : keys.length === 0 ? (
                    <div className="p-10 text-center">
                        <Key size={28} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm font-medium">No API keys yet</p>
                        <p className="text-slate-600 text-xs mt-1">Create a key to start ingesting events</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.05]">
                                {['Name', 'Prefix', 'Created', 'Last Used', ''].map((h) => (
                                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {keys.map((key: ApiKeyResponse) => (
                                <tr key={key.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-5 py-3.5 text-sm text-white font-medium">{key.name}</td>
                                    <td className="px-5 py-3.5">
                                        <code className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md">
                                            {key.key_prefix}…
                                        </code>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">
                                        {new Date(key.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">
                                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        {revokeConfirm === key.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs text-slate-400">Revoke?</span>
                                                <button
                                                    onClick={() => revoke(key.id)}
                                                    disabled={revoking}
                                                    className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs hover:bg-red-500/25 transition-all"
                                                >
                                                    {revoking ? '…' : 'Yes'}
                                                </button>
                                                <button
                                                    onClick={() => setRevokeConfirm(null)}
                                                    className="px-2.5 py-1 rounded-lg border border-white/[0.08] text-slate-400 text-xs hover:text-white transition-all"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setRevokeConfirm(key.id)}
                                                className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                title="Revoke key"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showNewModal && (
                <NewKeyModal
                    workspaceId={workspaceId}
                    onClose={() => setShowNewModal(false)}
                    onCreated={(key) => {
                        setShowNewModal(false)
                        setRevealedKey(key)
                        queryClient.invalidateQueries({ queryKey: ['api-keys', workspaceId] })
                    }}
                />
            )}
            {revealedKey && (
                <RevealedKeyModal apiKey={revealedKey} onClose={() => setRevealedKey(null)} />
            )}
        </div>
    )
}

// ─── Invite Member Modal ─────────────────────────────────────────────────────
function InviteMemberModal({
    workspaceId,
    onClose,
    onSuccess,
}: {
    workspaceId: string
    onClose: () => void
    onSuccess: () => void
}) {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<'owner'|'admin'|'member'|'viewer'>('member')
    const [error, setError] = useState<string | null>(null)

    const { mutate, isPending } = useMutation({
        mutationFn: () => workspacesApi.inviteMember(workspaceId, { email: email.trim(), role }),
        onSuccess: onSuccess,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => setError(err.response?.data?.detail || 'Failed to invite user.'),
    })

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-navy-800 border border-white/[0.08] rounded-2xl shadow-card-hover animate-fade-in">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                        <Users size={16} className="text-accent-cyan" />
                        <h3 className="text-sm font-semibold text-white">Invite Team Member</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={15} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">User Email</label>
                        <input
                            autoFocus
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@yourcompany.com"
                            className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
                        <select
                            value={role}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onChange={(e) => setRole(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer appearance-none"
                        >
                            <option value="admin">Admin (Can edit settings & invite)</option>
                            <option value="member">Member (Can view & create resources)</option>
                            <option value="viewer">Viewer (Read-only)</option>
                        </select>
                    </div>
                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => mutate()}
                            disabled={!email.trim() || isPending || !email.includes("@")}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 text-sm font-medium transition-all disabled:opacity-40"
                        >
                            {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {isPending ? 'Inviting…' : 'Invite User'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Tab: Team ────────────────────────────────────────────────────────────────
function TeamTab({ workspaceId }: { workspaceId: string }) {
    const queryClient = useQueryClient()
    const { showToast } = useToast()
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.getMe })
    const { data: members = [], isLoading } = useQuery({
        queryKey: ['members', workspaceId],
        queryFn: () => workspacesApi.getMembers(workspaceId),
        enabled: !!workspaceId,
    })

    const [showInvite, setShowInvite] = useState(false)
    const [removing, setRemoving] = useState<string | null>(null)

    const { mutate: removeMember } = useMutation({
        mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', workspaceId] }),
        onSettled: () => setRemoving(null)
    })

    const { mutate: changeRole } = useMutation({
        mutationFn: ({ userId, role }: { userId: string, role: string }) => 
            workspacesApi.changeMemberRole(workspaceId, userId, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members', workspaceId] })
            showToast('Member role updated.', 'success')
        },
        onError: (err: any) => {
            if (err.response?.status === 403) {
                showToast('Action Restricted: Only the Owner can change these permissions.', 'error')
            } else {
                showToast(err.response?.data?.detail || "Failed to change role.", 'error')
            }
        }
    })

    const myRole = members.find((m) => m.user_id === me?.id)?.role
    const canManageMembers = myRole === 'owner' || myRole === 'admin'

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
                </p>
                <button
                    onClick={() => setShowInvite(true)}
                    disabled={!canManageMembers}
                    className="flex items-center gap-2 px-3.5 py-2 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan rounded-xl text-sm font-medium hover:bg-accent-cyan/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={14} />
                    Invite Member
                </button>
            </div>

            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500 text-sm">Loading members…</div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {members.map((member: WorkspaceMemberWithUser) => {
                            const isMe = member.user_id === me?.id
                            const isShadow = member.user_name === member.user_email?.split('@')[0]?.charAt(0).toUpperCase() + member.user_email?.split('@')[0]?.slice(1) || member.user_name === ""
                            const displayName = member.user_name && !isShadow ? member.user_name : member.user_email

                            const initials = displayName
                                .split(' ')
                                .map((n: string) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)

                            return (
                                <div key={member.id} className={`flex items-center gap-4 px-5 py-4 ${isMe ? 'bg-cyan-500/[0.03]' : ''}`}>
                                    {/* Avatar */}
                                    {member.user_avatar_url ? (
                                        <img
                                            src={member.user_avatar_url}
                                            alt={displayName}
                                            className="w-9 h-9 rounded-full object-cover border border-white/[0.08] flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-600 to-navy-700 border border-white/[0.08] flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                                            {initials}
                                        </div>
                                    )}
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white truncate">
                                                {displayName}
                                            </span>
                                            {isMe && (
                                                <span className="text-[10px] text-slate-500 font-medium">(you)</span>
                                            )}
                                            {!isMe && isShadow && (
                                                <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 rounded font-medium">Invited</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{member.user_email}</p>
                                    </div>
                                    {/* Role Selection / Badge */}
                                    <div className="flex items-center gap-2">
                                        {canManageMembers && !isMe && member.role !== 'owner' ? (
                                            <select
                                                value={member.role}
                                                onChange={(e) => changeRole({ userId: member.user_id, role: e.target.value })}
                                                className="bg-navy-900 border border-white/[0.08] text-xs font-semibold text-slate-300 rounded-md px-2 py-1 focus:outline-none focus:border-cyan-500/50 cursor-pointer uppercase tracking-wider"
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="member">Member</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                        ) : (
                                            <RoleBadge role={member.role} />
                                        )}
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="w-16 flex justify-end">
                                        {!isMe && canManageMembers && member.role !== 'owner' && (
                                            removing === member.user_id ? (
                                                <Loader2 size={16} className="text-slate-500 animate-spin" />
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        if(confirm(`Remove ${displayName} from workspace?`)) setRemoving(member.user_id); removeMember(member.user_id)
                                                    }}
                                                    className="p-1.5 rounded-md text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {showInvite && (
                <InviteMemberModal 
                    workspaceId={workspaceId} 
                    onClose={() => setShowInvite(false)}
                    onSuccess={() => {
                        setShowInvite(false)
                        queryClient.invalidateQueries({ queryKey: ['members', workspaceId] })
                    }}
                />
            )}
        </div>
    )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
const TABS = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'team', label: 'Team', icon: Users },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('general')
    const workspaceId = WorkspaceStorage.get() ?? ''

    return (
        <div className="max-w-3xl space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-500/20 to-slate-600/20 border border-slate-500/20 flex items-center justify-center">
                    <Settings size={20} className="text-slate-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Manage your workspace, API keys, and team</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 p-1 bg-navy-800 border border-white/[0.06] rounded-xl w-fit">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        id={`settings-tab-${id}`}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === id
                                ? 'bg-white/[0.08] text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* No workspace guard */}
            {!workspaceId && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center mt-8">
                    <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
                    <p className="text-amber-300 text-sm">
                        No workspace selected. Use the workspace switcher in the top bar to select or create one.
                    </p>
                </div>
            )}

            {/* Tab content */}
            {workspaceId && (
                <div className="mt-8 animate-fade-in">
                    {activeTab === 'general' && <GeneralTab workspaceId={workspaceId} />}
                    {activeTab === 'api-keys' && <ApiKeysTab workspaceId={workspaceId} />}
                    {activeTab === 'team' && <TeamTab workspaceId={workspaceId} />}
                </div>
            )}
        </div>
    )
}

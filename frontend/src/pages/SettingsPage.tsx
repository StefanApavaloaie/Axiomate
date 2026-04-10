import { useState } from 'react'
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
} from 'lucide-react'
import { workspacesApi, apiKeysApi, authApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'
import type { ApiKeyCreatedResponse, ApiKeyResponse, WorkspaceMemberWithUser } from '@/types'

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

// ─── Revealed Key Modal (shown once after creation) ───────────────────────────
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
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
                        <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
                        <span className="text-amber-300/80 text-xs">
                            Store this key securely. It cannot be recovered after closing this dialog.
                        </span>
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
    const { data: workspace, isLoading } = useQuery({
        queryKey: ['workspace', workspaceId],
        queryFn: () => workspacesApi.getById(workspaceId),
        enabled: !!workspaceId,
    })
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.getMe })

    if (isLoading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-24 rounded-2xl bg-navy-800" />
            <div className="h-32 rounded-2xl bg-navy-800" />
        </div>
    }

    return (
        <div className="space-y-4">
            {/* Workspace identity card */}
            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-500/20 flex items-center justify-center text-xl font-bold text-accent-cyan flex-shrink-0">
                        {workspace?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white">{workspace?.name}</h3>
                        <p className="text-slate-500 text-sm mt-0.5">/{workspace?.slug}</p>
                        <p className="text-slate-600 text-xs mt-2">
                            Created {workspace?.created_at ? new Date(workspace.created_at).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Info fields */}
            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl divide-y divide-white/[0.05]">
                {[
                    { label: 'Workspace ID', value: workspaceId, mono: true, copyable: true },
                    { label: 'Slug', value: workspace?.slug ?? '—', mono: true, copyable: false },
                    { label: 'Your email', value: me?.email ?? '—', mono: false, copyable: false },
                ].map(({ label, value, mono, copyable }) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3.5">
                        <span className="text-sm text-slate-400">{label}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
                            {copyable && <CopyButton text={value} />}
                        </div>
                    </div>
                ))}
            </div>

            {/* SDK snippet */}
            <div className="bg-navy-800 border border-white/[0.07] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-300">Ingest endpoint</p>
                    <CopyButton text={`http://localhost:8000/api/v1/ingest/`} />
                </div>
                <code className="block text-xs font-mono text-cyan-300 bg-navy-900 rounded-xl px-4 py-3 break-all">
                    POST http://localhost:8000/api/v1/ingest/
                </code>
                <p className="text-slate-500 text-xs mt-2">
                    Use an API key from the <strong className="text-slate-400">API Keys</strong> tab as the <code className="text-cyan-400">X-API-Key</code> header.
                </p>
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

// ─── Tab: Team ────────────────────────────────────────────────────────────────
function TeamTab({ workspaceId }: { workspaceId: string }) {
    const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.getMe })
    const { data: members = [], isLoading } = useQuery({
        queryKey: ['members', workspaceId],
        queryFn: () => workspacesApi.getMembers(workspaceId),
        enabled: !!workspaceId,
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
                </p>
                <button
                    disabled
                    title="Coming soon"
                    className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.03] border border-white/[0.06] text-slate-600 rounded-xl text-sm cursor-not-allowed"
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
                            const initials = (member.user_name ?? member.user_email)
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)

                            return (
                                <div key={member.id} className={`flex items-center gap-4 px-5 py-4 ${isMe ? 'bg-cyan-500/[0.03]' : ''}`}>
                                    {/* Avatar */}
                                    {member.user_avatar_url ? (
                                        <img
                                            src={member.user_avatar_url}
                                            alt={member.user_name ?? 'User'}
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
                                                {member.user_name ?? member.user_email}
                                            </span>
                                            {isMe && (
                                                <span className="text-[10px] text-slate-500 font-medium">(you)</span>
                                            )}
                                        </div>
                                        {member.user_name && (
                                            <p className="text-xs text-slate-500 truncate">{member.user_email}</p>
                                        )}
                                    </div>
                                    {/* Role */}
                                    <RoleBadge role={member.role} />
                                    {/* Joined */}
                                    <span className="text-xs text-slate-600 hidden sm:block">
                                        Joined {new Date(member.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Coming soon notice */}
            <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl">
                <Shield size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300/70">
                    Member invitations and role management are coming in the next release. For now, new members can join by signing in with Google.
                </p>
            </div>
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
        <div className="max-w-3xl space-y-6">
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
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center">
                    <AlertTriangle size={24} className="text-amber-400 mx-auto mb-2" />
                    <p className="text-amber-300 text-sm">
                        No workspace selected. Use the workspace switcher in the top bar to select or create one.
                    </p>
                </div>
            )}

            {/* Tab content */}
            {workspaceId && (
                <>
                    {activeTab === 'general' && <GeneralTab workspaceId={workspaceId} />}
                    {activeTab === 'api-keys' && <ApiKeysTab workspaceId={workspaceId} />}
                    {activeTab === 'team' && <TeamTab workspaceId={workspaceId} />}
                </>
            )}
        </div>
    )
}

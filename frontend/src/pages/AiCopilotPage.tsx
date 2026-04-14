import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Cpu, Loader2, AlertTriangle } from 'lucide-react'
import { TokenStorage, WorkspaceStorage } from '@/api/client'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    streaming?: boolean
}

const API_BASE = 'http://localhost:8000/api/v1'

export default function AiCopilotPage() {
    const workspaceId = WorkspaceStorage.get()
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: workspaceId
                ? "Hi! I'm Axiomate Copilot. Ask me anything about your analytics, trends, or anomalies. For example: *'What are my top events?'*"
                : "Hi! Please select a workspace first using the switcher in the top bar, then I can answer questions about your data.",
        },
    ])
    const [isStreaming, setIsStreaming] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || isStreaming || !workspaceId) return

        const question = input.trim()
        setInput('')

        // Add user message
        const userMsgId = `user-${Date.now()}`
        const assistantMsgId = `assistant-${Date.now()}`

        setMessages(prev => [
            ...prev,
            { id: userMsgId, role: 'user', content: question },
            { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
        ])
        setIsStreaming(true)

        // Set up SSE streaming via fetch
        const controller = new AbortController()
        abortRef.current = controller

        try {
            const token = TokenStorage.getAccess()
            const response = await fetch(`${API_BASE}/ai/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ question, workspace_id: workspaceId }),
                signal: controller.signal,
            })

            if (!response.ok || !response.body) {
                throw new Error(`HTTP ${response.status}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''  // keep incomplete last line in buffer

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const payload = line.slice(6).trim()

                    if (payload === '[DONE]') {
                        // Mark streaming as finished
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === assistantMsgId ? { ...m, streaming: false } : m
                            )
                        )
                        break
                    }

                    try {
                        const chunk = JSON.parse(payload)

                        if (chunk.error) {
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: `⚠️ ${chunk.error}`, streaming: false }
                                        : m
                                )
                            )
                            break
                        }

                        if (chunk.token) {
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: m.content + chunk.token }
                                        : m
                                )
                            )
                        }
                    } catch {
                        // Malformed JSON chunk — skip
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                              ...m,
                              content: "⚠️ Couldn't reach the AI service. Make sure Ollama is running (`ollama serve`).",
                              streaming: false,
                          }
                        : m
                )
            )
        } finally {
            setIsStreaming(false)
            abortRef.current = null
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto animate-fade-in relative z-0">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between pb-6 mb-2 border-b border-white/[0.04]">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles size={24} className="text-accent-cyan" />
                        AI Copilot
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Chat with your data using self-hosted LLMs.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-medium text-accent-cyan">
                    <Cpu size={14} />
                    <span>Local Model · Ollama</span>
                </div>
            </div>

            {/* No workspace warning */}
            {!workspaceId && (
                <div className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-300 text-sm">
                    <AlertTriangle size={16} />
                    Select a workspace in the top bar to enable AI queries.
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-6 pb-6 pt-4">
                {messages.map((msg) => {
                    const isAssistant = msg.role === 'assistant'
                    return (
                        <div
                            key={msg.id}
                            className={`flex gap-4 max-w-[85%] ${isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                        >
                            <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${
                                    isAssistant
                                        ? 'bg-navy-800 border-white/[0.1] shadow-glow-cyan'
                                        : 'bg-cyan-500/20 border-cyan-500/30'
                                }`}
                            >
                                {isAssistant ? (
                                    <Bot size={16} className="text-accent-cyan" />
                                ) : (
                                    <User size={16} className="text-white" />
                                )}
                            </div>

                            <div
                                className={`relative px-5 py-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                    isAssistant
                                        ? 'bg-navy-800/80 border border-white/[0.06] text-slate-300 rounded-tl-none'
                                        : 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-md rounded-tr-none border border-white/[0.06]'
                                }`}
                            >
                                {msg.content}
                                {/* Blinking cursor while streaming */}
                                {msg.streaming && (
                                    <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
                                )}
                                {/* Empty streaming bubble placeholder */}
                                {msg.streaming && !msg.content && (
                                    <span className="text-slate-500 italic text-xs">Thinking…</span>
                                )}
                            </div>
                        </div>
                    )
                })}

                {/* Typing indicator shown only before first token arrives */}
                {isStreaming && messages[messages.length - 1]?.content === '' && (
                    <div className="flex gap-4 max-w-[85%] mr-auto">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy-800 border border-white/[0.1] shadow-glow-cyan flex items-center justify-center">
                            <Bot size={16} className="text-accent-cyan" />
                        </div>
                        <div className="bg-navy-800/80 border border-white/[0.06] rounded-2xl rounded-tl-none px-6 py-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 pt-4">
                <form
                    onSubmit={handleSubmit}
                    className="relative flex items-center bg-navy-800/80 border border-white/[0.12] focus-within:border-cyan-500/50 focus-within:shadow-glow-cyan rounded-2xl transition-all duration-300 backdrop-blur-sm"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isStreaming || !workspaceId}
                        placeholder={workspaceId ? 'Ask about your analytics data…' : 'Select a workspace first…'}
                        className="flex-1 bg-transparent px-6 py-4 text-white placeholder-slate-500 text-sm focus:outline-none disabled:opacity-50 font-medium"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isStreaming || !workspaceId}
                        className="absolute right-2 w-10 h-10 flex items-center justify-center rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 transition-colors shadow-md"
                    >
                        {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                    </button>
                </form>
                <p className="text-center text-[11px] text-slate-500 mt-3 font-medium tracking-wide">
                    Axiomate Copilot uses a locally hosted Ollama LLM. Requires `ollama serve` to be running.
                </p>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.4); }
            `}</style>
        </div>
    )
}

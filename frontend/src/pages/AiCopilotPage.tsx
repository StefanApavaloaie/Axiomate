import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Bot, User, Sparkles, Cpu, Loader2, AlertTriangle } from 'lucide-react'
import { aiApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'

type ChatMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
}

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

    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const { mutate: sendQuery, isPending } = useMutation({
        mutationFn: (question: string) => aiApi.query(workspaceId!, question),
        onSuccess: (data) => {
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    role: 'assistant',
                    // Backend returns 'answer', not 'llm_response'
                    content: data.answer,
                },
            ])
        },
        onError: (err: { response?: { status?: number } }) => {
            const status = err?.response?.status
            let msg =
                "I'm sorry, I couldn't reach the backend AI service. Make sure Ollama is running (`ollama serve`)."

            if (status === 503) {
                msg = "Ollama is not running. Start it with: `ollama serve` in a terminal, then try again."
            } else if (status === 403) {
                msg = "You don't have access to this workspace."
            }

            setMessages((prev) => [
                ...prev,
                { id: Date.now().toString(), role: 'assistant', content: msg },
            ])
        },
    })

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || isPending || !workspaceId) return

        const question = input.trim()
        setInput('')

        setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: 'user', content: question },
        ])

        sendQuery(question)
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
                            </div>
                        </div>
                    )
                })}

                {/* Loading Bubble */}
                {isPending && (
                    <div className="flex gap-4 max-w-[85%] mr-auto animate-pulse">
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
                        disabled={isPending || !workspaceId}
                        placeholder={workspaceId ? 'Ask about your analytics data…' : 'Select a workspace first…'}
                        className="flex-1 bg-transparent px-6 py-4 text-white placeholder-slate-500 text-sm focus:outline-none disabled:opacity-50 font-medium"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isPending || !workspaceId}
                        className="absolute right-2 w-10 h-10 flex items-center justify-center rounded-xl bg-cyan-500 text-white hover:bg-cyan-400 disabled:opacity-50 disabled:hover:bg-cyan-500 transition-colors shadow-md"
                    >
                        {isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
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

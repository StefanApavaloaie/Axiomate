import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, GripVertical } from 'lucide-react'
import { funnelsApi } from '@/api'
import { WorkspaceStorage } from '@/api/client'

const funnelSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    steps: z
        .array(
            z.object({
                event_name: z.string().min(1, 'Event name is required'),
            })
        )
        .min(2, 'At least 2 steps are required'),
})

type FunnelFormData = z.infer<typeof funnelSchema>

interface CreateFunnelModalProps {
    open: boolean
    onClose: () => void
}

export default function CreateFunnelModal({ open, onClose }: CreateFunnelModalProps) {
    const queryClient = useQueryClient()

    const { register, control, handleSubmit, reset, formState: { errors } } =
        useForm<FunnelFormData>({
            resolver: zodResolver(funnelSchema),
            defaultValues: {
                name: '',
                steps: [{ event_name: '' }, { event_name: '' }],
            },
        })

    const { fields, append, remove } = useFieldArray({ control, name: 'steps' })

    const { mutate, isPending } = useMutation({
        mutationFn: (data: FunnelFormData) => {
            const workspaceId = WorkspaceStorage.get()!
            return funnelsApi.create(workspaceId, {
                name: data.name,
                steps: data.steps.map((s, i) => ({
                    step: i + 1,
                    event_name: s.event_name,
                    filters: {},
                })),
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['funnels'] })
            reset()
            onClose()
        },
    })

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-navy-800 border border-white/[0.08] rounded-2xl shadow-card-hover animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Create Funnel</h2>
                        <p className="text-slate-400 text-sm">Define steps to track user journeys</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit((d) => mutate(d))} className="p-6 space-y-5">
                    {/* Funnel name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                            Funnel Name
                        </label>
                        <input
                            {...register('name')}
                            placeholder="e.g. Signup to Purchase"
                            className="w-full px-4 py-2.5 rounded-xl bg-navy-900 border border-white/[0.08] text-white placeholder-slate-600 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                        {errors.name && (
                            <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Steps */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-300">Steps</label>
                            <span className="text-xs text-slate-500">{fields.length} steps</span>
                        </div>

                        <div className="space-y-2">
                            {fields.map((field, i) => (
                                <div key={field.id} className="flex items-center gap-2 group">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[11px] font-bold text-accent-cyan flex-shrink-0">
                                            {i + 1}
                                        </div>
                                        <GripVertical size={14} className="text-slate-700 flex-shrink-0" />
                                        <input
                                            {...register(`steps.${i}.event_name`)}
                                            placeholder={`Event name (e.g. page_view)`}
                                            className="flex-1 px-3 py-2 rounded-xl bg-navy-900 border border-white/[0.06] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
                                        />
                                    </div>
                                    {fields.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(i)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {errors.steps && (
                                <p className="text-red-400 text-xs">{errors.steps.message}</p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => append({ event_name: '' })}
                            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.14] text-sm transition-all"
                        >
                            <Plus size={13} />
                            Add Step
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/20 text-sm font-medium transition-all disabled:opacity-50"
                        >
                            {isPending ? 'Creating…' : 'Create Funnel'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

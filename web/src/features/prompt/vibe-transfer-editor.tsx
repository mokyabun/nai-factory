import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { VibeTransfer, VibeTransferPatch } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Trash2, Upload } from 'lucide-react'
import { useCallback, useRef } from 'react'

import { formatRatio, LabeledSlider } from '@/components/form-fields'
import { StatusMessage } from '@/components/status-message'
import { Button } from '@/components/ui/button'
import { useAutosave } from '@/hooks/use-autosave'
import { useLocalOrder } from '@/hooks/use-local-order'
import { assetUrl, call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk, queries } from '@/lib/queries'
import { type OrderPatch, reorderById } from '@/lib/reorder'

interface SortableVibeItemProps {
    vibe: VibeTransfer
    onUpdate: (id: number, patch: VibeTransferPatch) => Promise<unknown>
    onDelete: (id: number) => void
}

function SortableVibeItem({ vibe, onUpdate, onDelete }: SortableVibeItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: vibe.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    const save = useCallback(
        (patch: VibeTransferPatch) => onUpdate(vibe.id, patch),
        [onUpdate, vibe.id],
    )
    const draft = useAutosave<VibeTransfer, VibeTransferPatch>({ data: vibe, save, delay: 400 })
    const { referenceStrength: refStrength, informationExtracted: infoExtracted } =
        draft.value ?? vibe

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-start gap-2 rounded-md border p-2"
        >
            <div className="flex flex-col items-center gap-1 h-full justify-between">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(vibe.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </div>

            <div className="h-20 w-20 shrink-0 overflow-hidden rounded border bg-muted">
                <img
                    src={assetUrl(vibe.sourceAssetId)}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                />
            </div>

            <div className="flex flex-1 flex-col p-1 justify-center h-full">
                <div className="flex flex-col gap-4">
                    <LabeledSlider
                        compact
                        label="레퍼런스 강도"
                        value={refStrength}
                        min={0}
                        max={1}
                        step={0.01}
                        format={formatRatio}
                        onChange={(value) => draft.update({ referenceStrength: value })}
                    />
                    <LabeledSlider
                        compact
                        label="정보 추출량"
                        value={infoExtracted}
                        min={0}
                        max={1}
                        step={0.01}
                        format={formatRatio}
                        onChange={(value) => draft.update({ informationExtracted: value })}
                    />
                </div>
            </div>
        </div>
    )
}

interface VibeTransferEditorProps {
    projectId: number
}

export function VibeTransferEditor({ projectId }: VibeTransferEditorProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const query = useQuery(queries.projects.vibeTransfers(projectId))
    const [items, setOrder] = useLocalOrder(query.data)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            call(contract.projects.uploadVibeTransfer, {
                params: { id: projectId },
                body: { image: file },
            }),
        onSuccess: (created) => {
            queryClient.setQueryData<VibeTransfer[]>(
                qk.projects.vibeTransfers(projectId),
                (current) => [...(current ?? []), created],
            )
            void queryClient.invalidateQueries({ queryKey: qk.projects.vibeTransfers(projectId) })
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: VibeTransferPatch }) =>
            call(contract.vibeTransfers.update, { params: { id }, body: patch }),
        onMutate: async ({ id, patch }) => {
            const previousItems = await snapshotQuery<VibeTransfer[]>(
                queryClient,
                qk.projects.vibeTransfers(projectId),
            )
            queryClient.setQueryData<VibeTransfer[]>(
                qk.projects.vibeTransfers(projectId),
                (current) =>
                    current?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            )
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSuccess: (updated) => {
            queryClient.setQueryData<VibeTransfer[]>(
                qk.projects.vibeTransfers(projectId),
                (current) => current?.map((item) => (item.id === updated.id ? updated : item)),
            )
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => call(contract.vibeTransfers.delete, { params: { id } }),
        onMutate: async (id) => {
            const previousItems = await snapshotQuery<VibeTransfer[]>(
                queryClient,
                qk.projects.vibeTransfers(projectId),
            )
            queryClient.setQueryData<VibeTransfer[]>(
                qk.projects.vibeTransfers(projectId),
                (current) => current?.filter((item) => item.id !== id),
            )
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: qk.projects.vibeTransfers(projectId) }),
    })

    const reorderMutation = useMutation({
        mutationFn: ({ id, beforeId, afterId }: OrderPatch & { items: VibeTransfer[] }) =>
            call(contract.vibeTransfers.move, { params: { id }, body: { beforeId, afterId } }),
        onMutate: async ({ items }) => {
            const previousItems = await snapshotQuery<VibeTransfer[]>(
                queryClient,
                qk.projects.vibeTransfers(projectId),
            )
            queryClient.setQueryData(qk.projects.vibeTransfers(projectId), items)
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: qk.projects.vibeTransfers(projectId) }),
    })

    const updateItem = updateMutation.mutateAsync
    const handleUpdate = useCallback(
        (id: number, patch: VibeTransferPatch) => updateItem({ id, patch }),
        [updateItem],
    )

    function handleDelete(id: number) {
        deleteMutation.mutate(id)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)

        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderById(items, activeId, overId)
        if (!reordered) return

        setOrder(reordered.items)
        reorderMutation.mutate({ ...reordered.orderPatch, items: reordered.items })
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (file) {
            uploadMutation.mutate(file)
            e.target.value = ''
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {query.isPending ? (
                <StatusMessage variant="inline">불러오는 중...</StatusMessage>
            ) : items.length === 0 ? (
                <StatusMessage variant="inline">바이브 이미지 없음</StatusMessage>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={items.map((v) => v.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-2">
                            {items.map((vibe) => (
                                <SortableVibeItem
                                    key={vibe.id}
                                    vibe={vibe}
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
            >
                <Upload className="h-3.5 w-3.5" />
                {uploadMutation.isPending ? '업로드 중...' : '이미지 업로드'}
            </Button>
        </div>
    )
}

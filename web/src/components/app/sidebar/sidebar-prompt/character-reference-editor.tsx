import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { CharacterReference, CharacterReferencePatch } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useCallback, useRef } from 'react'

import { StatusMessage } from '@/components/app/status-message'
import { Button } from '@/components/ui/button'
import { useLocalOrder } from '@/hooks/use-local-order'
import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk, queries } from '@/lib/queries'
import { type OrderPatch, reorderById } from '@/lib/reorder'

import { SortableCharacterReferenceItem } from './character-reference-item'

interface CharacterReferenceEditorProps {
    projectId: number
}

export function CharacterReferenceEditor({ projectId }: CharacterReferenceEditorProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const query = useQuery(queries.projects.characterReferences(projectId))
    const [items, setOrder] = useLocalOrder(query.data)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            call(contract.projects.uploadCharacterReference, {
                params: { id: projectId },
                body: { image: file },
            }),
        onSuccess: (created) => {
            queryClient.setQueryData<CharacterReference[]>(
                qk.projects.characterReferences(projectId),
                (current) => [...(current ?? []), created],
            )
            void queryClient.invalidateQueries({
                queryKey: qk.projects.characterReferences(projectId),
            })
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: CharacterReferencePatch }) =>
            call(contract.characterReferences.update, { params: { id }, body: patch }),
        onMutate: async ({ id, patch }) => {
            const previousItems = await snapshotQuery<CharacterReference[]>(
                queryClient,
                qk.projects.characterReferences(projectId),
            )
            queryClient.setQueryData<CharacterReference[]>(
                qk.projects.characterReferences(projectId),
                (current) =>
                    current?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            )
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSuccess: (updated) => {
            queryClient.setQueryData<CharacterReference[]>(
                qk.projects.characterReferences(projectId),
                (current) => current?.map((item) => (item.id === updated.id ? updated : item)),
            )
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => call(contract.characterReferences.delete, { params: { id } }),
        onMutate: async (id) => {
            const previousItems = await snapshotQuery<CharacterReference[]>(
                queryClient,
                qk.projects.characterReferences(projectId),
            )
            queryClient.setQueryData<CharacterReference[]>(
                qk.projects.characterReferences(projectId),
                (current) => current?.filter((item) => item.id !== id),
            )
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: qk.projects.characterReferences(projectId) }),
    })

    const reorderMutation = useMutation({
        mutationFn: ({ id, beforeId, afterId }: OrderPatch & { items: CharacterReference[] }) =>
            call(contract.characterReferences.move, {
                params: { id },
                body: { beforeId, afterId },
            }),
        onMutate: async ({ items }) => {
            const previousItems = await snapshotQuery<CharacterReference[]>(
                queryClient,
                qk.projects.characterReferences(projectId),
            )
            queryClient.setQueryData(qk.projects.characterReferences(projectId), items)
            return { previousItems }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousItems)
        },
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: qk.projects.characterReferences(projectId) }),
    })

    const updateItem = updateMutation.mutateAsync
    const handleUpdate = useCallback(
        (id: number, patch: CharacterReferencePatch) => updateItem({ id, patch }),
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

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (file) {
            uploadMutation.mutate(file)
            event.target.value = ''
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
                <StatusMessage variant="inline">캐릭터 레퍼런스 없음</StatusMessage>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={items.map((reference) => reference.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-2">
                            {items.map((reference) => (
                                <SortableCharacterReferenceItem
                                    key={reference.id}
                                    reference={reference}
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
                {uploadMutation.isPending ? '업로드 중...' : '캐릭터 레퍼런스 업로드'}
            </Button>
        </div>
    )
}

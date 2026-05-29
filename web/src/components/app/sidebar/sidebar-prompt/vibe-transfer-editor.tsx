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
import type { VibeTransfer, VibeTransferPatchBody } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { GripVertical, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import {
    createVibeTransferItemDraft,
    reorderItems,
    vibeTransferItemDraftAtom,
    vibeTransferItemsAtom,
} from './atom'

interface SortableVibeItemProps {
    vibe: VibeTransfer
    onUpdate: (id: number, patch: VibeTransferPatchBody) => void
    onDelete: (id: number) => void
}

function SortableVibeItem({ vibe, onUpdate, onDelete }: SortableVibeItemProps) {
    return (
        <Provider>
            <SortableVibeItemContent vibe={vibe} onUpdate={onUpdate} onDelete={onDelete} />
        </Provider>
    )
}

function SortableVibeItemContent({ vibe, onUpdate, onDelete }: SortableVibeItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: vibe.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    const [draftValue, setDraft] = useAtom(vibeTransferItemDraftAtom)
    const draft = draftValue ?? createVibeTransferItemDraft(vibe)
    const refStrength = draft.referenceStrength
    const infoExtracted = draft.informationExtracted

    const onUpdateRef = useRef(onUpdate)
    onUpdateRef.current = onUpdate

    const debouncedUpdate = useRef(
        debounce((id: number, patch: VibeTransferPatchBody) => {
            onUpdateRef.current(id, patch)
        }, 400),
    )

    useEffect(() => {
        setDraft(createVibeTransferItemDraft(vibe))
    }, [vibe, setDraft])

    function handleRefStrengthChange(value: number) {
        setDraft((current) => ({
            ...(current ?? createVibeTransferItemDraft(vibe)),
            referenceStrength: value,
        }))
        debouncedUpdate.current(vibe.id, { referenceStrength: value })
    }

    function handleInfoExtractedChange(value: number) {
        setDraft((current) => ({
            ...(current ?? createVibeTransferItemDraft(vibe)),
            informationExtracted: value,
        }))
        debouncedUpdate.current(vibe.id, { informationExtracted: value })
    }

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-start gap-2 rounded-md border p-2"
        >
            <div className="flex flex-col items-center gap-1 h-full justify-between">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
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
                    src={imageUrl(vibe.sourceImagePath)}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                />
            </div>

            <div className="flex flex-1 flex-col p-1 justify-center h-full">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">레퍼런스 강도</Label>
                            <span className="text-xs text-muted-foreground">
                                {refStrength.toFixed(2)}
                            </span>
                        </div>
                        <Slider
                            value={[refStrength]}
                            min={0}
                            max={1}
                            step={0.01}
                            onValueChange={(value) =>
                                handleRefStrengthChange(sliderValue(value, refStrength))
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">정보 추출량</Label>
                            <span className="text-xs text-muted-foreground">
                                {infoExtracted.toFixed(2)}
                            </span>
                        </div>
                        <Slider
                            value={[infoExtracted]}
                            min={0}
                            max={1}
                            step={0.01}
                            onValueChange={(value) =>
                                handleInfoExtractedChange(sliderValue(value, infoExtracted))
                            }
                        />
                    </div>
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
    const items = useAtomValue(vibeTransferItemsAtom)
    const setItems = useSetAtom(vibeTransferItemsAtom)

    const query = useQuery({
        queryKey: qk.vibeTransfers(projectId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId })['vibe-transfers'].get()
            return data ?? []
        },
    })

    useEffect(() => {
        if (query.data) setItems(query.data)
    }, [query.data, setItems])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            api.projects({ projectId })['vibe-transfers'].upload.post({ image: file }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vibeTransfers(projectId) }),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: VibeTransferPatchBody }) =>
            api.projects({ projectId })['vibe-transfers']({ id }).patch(patch),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.projects({ projectId })['vibe-transfers']({ id }).delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vibeTransfers(projectId) }),
    })

    const reorderMutation = useMutation({
        mutationFn: ({
            id,
            prevId,
            nextId,
        }: {
            id: number
            prevId: number | null
            nextId: number | null
        }) => api.projects({ projectId })['vibe-transfers'].reorder.patch({ id, prevId, nextId }),
    })

    function handleUpdate(id: number, patch: VibeTransferPatchBody) {
        updateMutation.mutate({ id, patch })
    }

    function handleDelete(id: number) {
        deleteMutation.mutate(id)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)

        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderItems(items, activeId, overId)
        if (!reordered) return

        setItems(reordered.items)
        reorderMutation.mutate(reordered.orderPatch)
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
                <div className="py-4 text-center text-xs text-muted-foreground">불러오는 중...</div>
            ) : items.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    바이브 이미지 없음
                </div>
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

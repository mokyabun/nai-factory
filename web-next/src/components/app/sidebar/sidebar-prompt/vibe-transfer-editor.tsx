import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

type VibeTransfer = {
    id: number
    projectId: number
    displayOrder: string
    sourceImagePath: string
    referenceStrength: number
    informationExtracted: number
}

interface SortableVibeItemProps {
    vibe: VibeTransfer
    onUpdate: (
        id: number,
        patch: { referenceStrength?: number; informationExtracted?: number },
    ) => void
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

    const [refStrength, setRefStrength] = useState(vibe.referenceStrength)
    const [infoExtracted, setInfoExtracted] = useState(vibe.informationExtracted)

    const onUpdateRef = useRef(onUpdate)
    onUpdateRef.current = onUpdate

    const debouncedUpdate = useRef(
        debounce(
            (id: number, patch: { referenceStrength?: number; informationExtracted?: number }) => {
                onUpdateRef.current(id, patch)
            },
            400,
        ),
    )

    useEffect(() => {
        setRefStrength(vibe.referenceStrength)
        setInfoExtracted(vibe.informationExtracted)
    }, [vibe.referenceStrength, vibe.informationExtracted])

    function handleRefStrengthChange(value: number) {
        setRefStrength(value)
        debouncedUpdate.current(vibe.id, { referenceStrength: value })
    }

    function handleInfoExtractedChange(value: number) {
        setInfoExtracted(value)
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
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4" />
            </button>

            <div className="h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted">
                <img
                    src={imageUrl(vibe.sourceImagePath)}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                />
            </div>

            <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-1">
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
                <div className="flex flex-col gap-1">
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

            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(vibe.id)}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

interface VibeTransferEditorProps {
    projectId: number
}

export function VibeTransferEditor({ projectId }: VibeTransferEditorProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const query = useQuery({
        queryKey: qk.vibeTransfers(projectId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId })['vibe-transfers'].get()
            return (data ?? []) as VibeTransfer[]
        },
    })

    const [items, setItems] = useState<VibeTransfer[]>([])

    useEffect(() => {
        if (query.data) setItems(query.data)
    }, [query.data])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            api.projects({ projectId })['vibe-transfers'].upload.post({ image: file }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vibeTransfers(projectId) }),
    })

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            patch,
        }: {
            id: number
            patch: { referenceStrength?: number; informationExtracted?: number }
        }) => api.projects({ projectId })['vibe-transfers']({ id }).patch(patch),
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

    function handleUpdate(
        id: number,
        patch: { referenceStrength?: number; informationExtracted?: number },
    ) {
        updateMutation.mutate({ id, patch })
    }

    function handleDelete(id: number) {
        deleteMutation.mutate(id)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = items.findIndex((v) => v.id === active.id)
        const newIndex = items.findIndex((v) => v.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)

        const prevId = newIndex > 0 ? newItems[newIndex - 1].id : null
        const nextId = newIndex < newItems.length - 1 ? newItems[newIndex + 1].id : null
        reorderMutation.mutate({ id: active.id as number, prevId, nextId })
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

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
import type { CharacterReference, CharacterReferencePatchBody } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { GripVertical, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { api, imageUrl } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import {
    characterReferenceItemDraftAtom,
    characterReferenceItemsAtom,
    createCharacterReferenceItemDraft,
    reorderItems,
} from './atom'

const REFERENCE_MODES = [
    { value: 'character&style', label: '캐릭터+스타일' },
    { value: 'character', label: '캐릭터' },
    { value: 'style', label: '스타일' },
] as const

type ReferenceMode = (typeof REFERENCE_MODES)[number]['value']

interface SortableCharacterReferenceItemProps {
    reference: CharacterReference
    onUpdate: (id: number, patch: CharacterReferencePatchBody) => void
    onDelete: (id: number) => void
}

function SortableCharacterReferenceItem({
    reference,
    onUpdate,
    onDelete,
}: SortableCharacterReferenceItemProps) {
    return (
        <Provider>
            <SortableCharacterReferenceItemContent
                reference={reference}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />
        </Provider>
    )
}

function SortableCharacterReferenceItemContent({
    reference,
    onUpdate,
    onDelete,
}: SortableCharacterReferenceItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: reference.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    const [draftValue, setDraft] = useAtom(characterReferenceItemDraftAtom)
    const draft = draftValue ?? createCharacterReferenceItemDraft(reference)
    const { strength, fidelity, referenceMode, enabled } = draft

    const onUpdateRef = useRef(onUpdate)
    onUpdateRef.current = onUpdate

    const debouncedUpdate = useRef(
        debounce((id: number, patch: CharacterReferencePatchBody) => {
            onUpdateRef.current(id, patch)
        }, 400),
    )

    useEffect(() => {
        setDraft(createCharacterReferenceItemDraft(reference))
    }, [reference, setDraft])

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    function handleStrengthChange(value: number) {
        setDraft((current) => ({
            ...(current ?? createCharacterReferenceItemDraft(reference)),
            strength: value,
        }))
        debouncedUpdate.current(reference.id, { strength: value })
    }

    function handleFidelityChange(value: number) {
        setDraft((current) => ({
            ...(current ?? createCharacterReferenceItemDraft(reference)),
            fidelity: value,
        }))
        debouncedUpdate.current(reference.id, { fidelity: value })
    }

    function handleReferenceModeChange(value: string | null) {
        if (!value) return

        const mode = value as ReferenceMode
        setDraft((current) => ({
            ...(current ?? createCharacterReferenceItemDraft(reference)),
            referenceMode: mode,
        }))
        onUpdate(reference.id, { referenceMode: mode })
    }

    function handleEnabledChange(value: boolean) {
        setDraft((current) => ({
            ...(current ?? createCharacterReferenceItemDraft(reference)),
            enabled: value,
        }))
        onUpdate(reference.id, { enabled: value })
    }

    const previewPath =
        reference.thumbnailPath ?? reference.processedImagePath ?? reference.sourceImagePath

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col gap-3 rounded-md border p-2">
            <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(reference.id)}
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

                <div className="h-24 w-20 shrink-0 overflow-hidden rounded border bg-muted">
                    <img
                        src={imageUrl(previewPath)}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                    />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">사용</Label>
                        <Switch checked={enabled} onCheckedChange={handleEnabledChange} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">모드</Label>
                        <Select value={referenceMode} onValueChange={handleReferenceModeChange}>
                            <SelectTrigger className="h-7 w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {REFERENCE_MODES.map((mode) => (
                                    <SelectItem key={mode.value} value={mode.value}>
                                        {mode.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">강도</Label>
                        <span className="text-xs text-muted-foreground">{strength.toFixed(2)}</span>
                    </div>
                    <Slider
                        value={[strength]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={(value) =>
                            handleStrengthChange(sliderValue(value, strength))
                        }
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">충실도</Label>
                        <span className="text-xs text-muted-foreground">{fidelity.toFixed(2)}</span>
                    </div>
                    <Slider
                        value={[fidelity]}
                        min={0}
                        max={1}
                        step={0.01}
                        onValueChange={(value) =>
                            handleFidelityChange(sliderValue(value, fidelity))
                        }
                    />
                </div>
            </div>
        </div>
    )
}

interface CharacterReferenceEditorProps {
    projectId: number
}

export function CharacterReferenceEditor({ projectId }: CharacterReferenceEditorProps) {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const items = useAtomValue(characterReferenceItemsAtom)
    const setItems = useSetAtom(characterReferenceItemsAtom)

    const query = useQuery({
        queryKey: qk.characterReferences(projectId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId })['character-references'].get()
            return data ?? []
        },
    })

    useEffect(() => {
        if (query.data) setItems(query.data)
    }, [query.data, setItems])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const uploadMutation = useMutation({
        mutationFn: (file: File) =>
            api.projects({ projectId })['character-references'].upload.post({ image: file }),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: qk.characterReferences(projectId) }),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, patch }: { id: number; patch: CharacterReferencePatchBody }) =>
            api.projects({ projectId })['character-references']({ id }).patch(patch),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            api.projects({ projectId })['character-references']({ id }).delete(),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: qk.characterReferences(projectId) }),
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
        }) =>
            api.projects({ projectId })['character-references'].reorder.patch({
                id,
                prevId,
                nextId,
            }),
    })

    function handleUpdate(id: number, patch: CharacterReferencePatchBody) {
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
                <div className="py-4 text-center text-xs text-muted-foreground">불러오는 중...</div>
            ) : items.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    캐릭터 레퍼런스 없음
                </div>
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

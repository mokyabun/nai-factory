import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { CodeEditor } from '#/components/app/code-editor/code-editor'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'

type CharacterPrompt = {
    enabled: boolean
    center: { x: number; y: number }
    prompt: string
    uc: string
}

interface SortableItemProps {
    id: number
    cp: CharacterPrompt
    onUpdate: (updated: Partial<CharacterPrompt>) => void
    onRemove: () => void
}

function SortableItem({ id, cp, onUpdate, onRemove }: SortableItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : cp.enabled ? 1 : 0.5,
    }

    return (
        <div ref={setNodeRef} style={style}>
            <Tabs defaultValue="prompt" className="flex flex-col overflow-hidden border">
                <TabsList className="bg-transparent w-full justify-between my-1 pr-2">
                    <div className="flex items-center">
                        <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            className="flex h-7 w-7 cursor-grab items-center justify-center active:cursor-grabbing"
                        >
                            <GripVertical className="h-3 w-3" />
                        </button>
                        <TabsTrigger value="prompt" className="flex-1 text-xs">
                            프롬프트
                        </TabsTrigger>
                        <TabsTrigger value="negative" className="flex-1 text-xs">
                            부정 프롬프트
                        </TabsTrigger>
                    </div>
                    <div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            onClick={() => onUpdate({ enabled: !cp.enabled })}
                        >
                            {cp.enabled ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <X className="h-3.5 w-3.5" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={onRemove}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </TabsList>
                <TabsContent value="prompt" className="flex-1 overflow-hidden">
                    <CodeEditor
                        value={cp.prompt}
                        placeholder="프롬프트를 입력하세요..."
                        minLines={6}
                        className="h-full"
                        onChange={(value) => onUpdate({ prompt: value })}
                    />
                </TabsContent>
                <TabsContent value="negative" className="flex-1 overflow-hidden">
                    <CodeEditor
                        value={cp.uc}
                        placeholder="부정 프롬프트를 입력하세요..."
                        minLines={6}
                        className="h-full"
                        onChange={(value) => onUpdate({ uc: value })}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

interface CharacterPromptEditorProps {
    projectId: number
    characterPrompts: CharacterPrompt[]
}

export function CharacterPromptEditor({ projectId, characterPrompts }: CharacterPromptEditorProps) {
    const queryClient = useQueryClient()

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    async function save(newPrompts: CharacterPrompt[]) {
        await api.projects({ projectId }).patch({ characterPrompts: newPrompts })
        queryClient.invalidateQueries({ queryKey: qk.project(projectId) })
    }

    async function addCharacter() {
        await save([...characterPrompts, { enabled: true, center: { x: 0, y: 0 }, prompt: '', uc: '' }])
    }

    async function updateCharacter(index: number, updated: Partial<CharacterPrompt>) {
        await save(characterPrompts.map((cp, i) => (i === index ? { ...cp, ...updated } : cp)))
    }

    async function removeCharacter(index: number) {
        await save(characterPrompts.filter((_, i) => i !== index))
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = characterPrompts.findIndex((_, i) => i === active.id)
        const newIndex = characterPrompts.findIndex((_, i) => i === over.id)
        save(arrayMove(characterPrompts, oldIndex, newIndex))
    }

    return (
        <div className="flex flex-col gap-3">
            {characterPrompts.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                    캐릭터 프롬프트 없음
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={characterPrompts.map((_, i) => i)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-3">
                            {characterPrompts.map((cp, i) => (
                                <SortableItem
                                    key={i}
                                    id={i}
                                    cp={cp}
                                    onUpdate={(updated) => updateCharacter(i, updated)}
                                    onRemove={() => removeCharacter(i)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <Button variant="outline" size="sm" className="gap-1.5" onClick={addCharacter}>
                <Plus className="h-3.5 w-3.5" />
                캐릭터 추가
            </Button>
        </div>
    )
}

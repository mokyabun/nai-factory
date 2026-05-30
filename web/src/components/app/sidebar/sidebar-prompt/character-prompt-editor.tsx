import type { DragEndEvent } from '@dnd-kit/core'
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterPrompt } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useRef } from 'react'
import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { tagCompletionSource } from '@/lib/tag-autocomplete'
import { debounce } from '@/lib/utils'

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
            <Tabs
                defaultValue="prompt"
                className="flex h-[200px] flex-col overflow-hidden border scrollbar-thin"
            >
                <TabsList className="bg-transparent w-full shrink-0 justify-between my-1 pr-2">
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
                        completionSource={tagCompletionSource}
                        onChange={(value) => onUpdate({ prompt: value })}
                    />
                </TabsContent>
                <TabsContent value="negative" className="flex-1 overflow-hidden">
                    <CodeEditor
                        value={cp.uc}
                        placeholder="부정 프롬프트를 입력하세요..."
                        minLines={6}
                        className="h-full"
                        completionSource={tagCompletionSource}
                        onChange={(value) => onUpdate({ uc: value })}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

interface CharacterPromptProps {
    projectId: number
    characterPrompts: CharacterPrompt[]
}

export function CharacterPromptEditor({ projectId, characterPrompts }: CharacterPromptProps) {
    const queryClient = useQueryClient()

    // Keep a ref to latest characterPrompts for use inside the debounced save
    const characterPromptsRef = useRef(characterPrompts)
    characterPromptsRef.current = characterPrompts

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    async function save(newPrompts: CharacterPrompt[]) {
        await api.projects({ projectId }).patch({ characterPrompts: newPrompts })
        queryClient.invalidateQueries({ queryKey: qk.project(projectId) })
    }

    const saveDebounced = useRef(debounce((newPrompts: CharacterPrompt[]) => save(newPrompts), 600))

    async function addCharacter() {
        await save([
            ...characterPrompts,
            { enabled: true, center: { x: 0, y: 0 }, prompt: '', uc: '' },
        ])
    }

    function updateCharacter(index: number, updated: Partial<CharacterPrompt>) {
        const newPrompts = characterPromptsRef.current.map((cp, i) =>
            i === index ? { ...cp, ...updated } : cp,
        )
        saveDebounced.current(newPrompts)
    }

    async function removeCharacter(index: number) {
        saveDebounced.current.cancel()
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
                                    // biome-ignore lint/suspicious/noArrayIndexKey: character prompts are ordered value objects without persisted ids.
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

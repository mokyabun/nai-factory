import type { CompletionSource } from '@codemirror/autocomplete'
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
import {
    type CharacterPrompt,
    DEFAULT_CHARACTER_CENTER,
    type PromptVariable,
} from '@nai-factory/shared'
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'

import { CodeEditor } from '@/components/code-editor/code-editor'
import { StatusMessage } from '@/components/status-message'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { CharacterPositionPicker } from './character-position-picker'
import { createPromptCompletionSource } from './tag-autocomplete'

interface SortableItemProps {
    id: number
    cp: CharacterPrompt
    completionSource: CompletionSource
    usePositions: boolean
    onUsePositionsChange: (enabled: boolean) => void
    onUpdate: (updated: Partial<CharacterPrompt>) => void
    onRemove: () => void
}

function SortableItem({
    id,
    cp,
    completionSource,
    usePositions,
    onUsePositionsChange,
    onUpdate,
    onRemove,
}: SortableItemProps) {
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
                className="relative flex h-[200px] shrink-0 flex-col overflow-hidden border scrollbar-thin"
            >
                <TabsList className="bg-transparent w-full shrink-0 justify-between my-1 pr-2">
                    <div className="flex items-center">
                        <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            className="flex h-9 w-9 cursor-grab items-center justify-center active:cursor-grabbing"
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
                    <div className="flex items-center">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-primary"
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
                            size="icon-xs"
                            className="text-muted-foreground hover:text-destructive"
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
                        completionSource={completionSource}
                        onChange={(value) => onUpdate({ prompt: value })}
                    />
                </TabsContent>
                <TabsContent value="negative" className="flex-1 overflow-hidden">
                    <CodeEditor
                        value={cp.uc}
                        placeholder="부정 프롬프트를 입력하세요..."
                        minLines={6}
                        className="h-full"
                        completionSource={completionSource}
                        onChange={(value) => onUpdate({ uc: value })}
                    />
                </TabsContent>
                <CharacterPositionPicker
                    center={cp.center}
                    enabled={usePositions}
                    onCenterChange={(center) => onUpdate({ center })}
                    onEnabledChange={onUsePositionsChange}
                    className="absolute right-1.5 bottom-1.5 z-10"
                />
            </Tabs>
        </div>
    )
}

interface CharacterPromptProps {
    characterPrompts: CharacterPrompt[]
    variables?: PromptVariable
    /** `useCharacterPositions` of the parameters; toggled from each character's position picker. */
    usePositions: boolean
    onUsePositionsChange: (enabled: boolean) => void
    /** Edits are saved after a pause; adding, removing and reordering save at once. */
    onChange: (characterPrompts: CharacterPrompt[], options?: { immediate?: boolean }) => void
}

export function CharacterPromptEditor({
    characterPrompts,
    variables = [],
    usePositions,
    onUsePositionsChange,
    onChange,
}: CharacterPromptProps) {
    const completionSource = useMemo(() => createPromptCompletionSource(variables), [variables])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function addCharacter() {
        onChange(
            [
                ...characterPrompts,
                {
                    enabled: true,
                    center: { ...DEFAULT_CHARACTER_CENTER },
                    prompt: '',
                    uc: '',
                },
            ],
            { immediate: true },
        )
    }

    function updateCharacter(index: number, updated: Partial<CharacterPrompt>) {
        onChange(characterPrompts.map((cp, i) => (i === index ? { ...cp, ...updated } : cp)))
    }

    function removeCharacter(index: number) {
        onChange(
            characterPrompts.filter((_, i) => i !== index),
            { immediate: true },
        )
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = characterPrompts.findIndex((_, i) => i === active.id)
        const newIndex = characterPrompts.findIndex((_, i) => i === over.id)
        onChange(arrayMove(characterPrompts, oldIndex, newIndex), { immediate: true })
    }

    return (
        <div className="flex flex-col gap-3">
            {characterPrompts.length === 0 ? (
                <StatusMessage variant="inline">캐릭터 프롬프트 없음</StatusMessage>
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
                                    // Index keys: character prompts have no persisted ids.
                                    key={i}
                                    id={i}
                                    cp={cp}
                                    completionSource={completionSource}
                                    usePositions={usePositions}
                                    onUsePositionsChange={onUsePositionsChange}
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

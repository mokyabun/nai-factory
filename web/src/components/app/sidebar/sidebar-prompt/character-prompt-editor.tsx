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
import type { CharacterPrompt, Project, PromptVariable } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useRef } from 'react'

import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { type QuerySnapshot, requireApiResult, restoreSnapshot } from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import { createPromptCompletionSource } from '@/lib/tag-autocomplete'
import { debounce } from '@/lib/utils'

interface SortableItemProps {
    id: number
    cp: CharacterPrompt
    completionSource: CompletionSource
    onUpdate: (updated: Partial<CharacterPrompt>) => void
    onRemove: () => void
}

function SortableItem({ id, cp, completionSource, onUpdate, onRemove }: SortableItemProps) {
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
                className="flex h-[200px] shrink-0 flex-col overflow-hidden border scrollbar-thin"
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
                    <div>
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
            </Tabs>
        </div>
    )
}

interface CharacterPromptProps {
    projectId: number
    characterPrompts: CharacterPrompt[]
    variables?: PromptVariable
}

export function CharacterPromptEditor({
    projectId,
    characterPrompts,
    variables = [],
}: CharacterPromptProps) {
    const queryClient = useQueryClient()
    const completionSource = useMemo(() => createPromptCompletionSource(variables), [variables])

    // Keep a ref to latest characterPrompts for use inside the debounced save
    const characterPromptsRef = useRef(characterPrompts)
    // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
    characterPromptsRef.current = characterPrompts
    const rollbackProjectRef = useRef<QuerySnapshot<Project> | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function applyOptimisticPrompts(newPrompts: CharacterPrompt[]) {
        if (!rollbackProjectRef.current) {
            rollbackProjectRef.current = {
                queryKey: qk.project(projectId),
                data: queryClient.getQueryData<Project>(qk.project(projectId)),
            }
        }

        characterPromptsRef.current = newPrompts
        queryClient.setQueryData<Project | null>(qk.project(projectId), (project) =>
            project ? { ...project, characterPrompts: newPrompts } : project,
        )
    }

    async function save(newPrompts: CharacterPrompt[]) {
        applyOptimisticPrompts(newPrompts)

        try {
            const { data } = await requireApiResult(
                api.projects({ projectId }).patch({ characterPrompts: newPrompts }),
            )
            if (data) queryClient.setQueryData(qk.project(projectId), data)
            rollbackProjectRef.current = null
        } catch {
            restoreSnapshot(queryClient, rollbackProjectRef.current ?? undefined)
            rollbackProjectRef.current = null
        } finally {
            void queryClient.invalidateQueries({ queryKey: qk.project(projectId) })
        }
    }

    // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
    const saveDebounced = useRef(debounce((newPrompts: CharacterPrompt[]) => save(newPrompts), 600))

    async function addCharacter() {
        saveDebounced.current.cancel()
        await save([
            ...characterPromptsRef.current,
            { enabled: true, center: { x: 0, y: 0 }, prompt: '', uc: '' },
        ])
    }

    function updateCharacter(index: number, updated: Partial<CharacterPrompt>) {
        const newPrompts = characterPromptsRef.current.map((cp, i) =>
            i === index ? { ...cp, ...updated } : cp,
        )
        applyOptimisticPrompts(newPrompts)
        saveDebounced.current(newPrompts)
    }

    async function removeCharacter(index: number) {
        saveDebounced.current.cancel()
        await save(characterPromptsRef.current.filter((_, i) => i !== index))
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = characterPromptsRef.current.findIndex((_, i) => i === active.id)
        const newIndex = characterPromptsRef.current.findIndex((_, i) => i === over.id)
        void save(arrayMove(characterPromptsRef.current, oldIndex, newIndex))
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
                                    // character prompts are ordered value objects without persisted ids.
                                    key={i}
                                    id={i}
                                    cp={cp}
                                    completionSource={completionSource}
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

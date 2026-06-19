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
import type { PromptVariable, SceneVariationDraft } from '@nai-factory/shared'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { variableValidationMessage } from '@/lib/prompt-variables'

interface VariationEditorProps {
    variations: SceneVariationDraft[]
    onChange: (variations: SceneVariationDraft[]) => void
}

type SortableVariationProps = {
    id: string | number
    variation: SceneVariationDraft
    varIdx: number
    onAddKey: (varIdx: number) => void
    onRemoveVariation: (varIdx: number) => void
    onRemoveKey: (varIdx: number, keyIdx: number) => void
    onUpdateKey: (varIdx: number, keyIdx: number, newKey: string) => void
    onUpdateValue: (varIdx: number, keyIdx: number, value: string) => void
}

function itemId(variation: SceneVariationDraft, index: number) {
    return variation.id ?? `new-${index}`
}

function SortableVariation({
    id,
    variation,
    varIdx,
    onAddKey,
    onRemoveVariation,
    onRemoveKey,
    onUpdateKey,
    onUpdateValue,
}: SortableVariationProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }
    const validationMessage = variableValidationMessage(variation.variables)

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex gap-2 ${isDragging ? 'opacity-50' : ''}`}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="mt-3 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border bg-background text-muted-foreground active:cursor-grabbing"
            >
                <GripVertical className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1 rounded-md border bg-card p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="min-w-0 text-xs font-medium text-muted-foreground">
                        변수 세트 {varIdx + 1}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => onAddKey(varIdx)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveVariation(varIdx)}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border bg-background p-3">
                    <div className="flex flex-col gap-2">
                        {variation.variables.map(({ key, value }, keyIdx) => (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: variable draft rows can share empty keys until edited.
                                key={keyIdx}
                                className="flex flex-col gap-1"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        className="h-7 flex-1 px-2 font-mono text-xs"
                                        value={key}
                                        placeholder="변수명"
                                        onChange={(e) =>
                                            onUpdateKey(varIdx, keyIdx, e.target.value)
                                        }
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 text-muted-foreground"
                                        onClick={() => onRemoveKey(varIdx, keyIdx)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                <CodeEditor
                                    value={value}
                                    placeholder="값 (태그, 프롬프트 등)..."
                                    minLines={2}
                                    onChange={(v) => onUpdateValue(varIdx, keyIdx, v)}
                                />
                            </div>
                        ))}
                        {validationMessage && (
                            <p className="text-[11px] text-destructive">{validationMessage}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function VariationEditor({ variations, onChange }: VariationEditorProps) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
    const ids = variations.map(itemId)

    function addVariation() {
        onChange([...variations, { variables: [] }])
    }

    function removeVariation(i: number) {
        onChange(variations.filter((_, idx) => idx !== i))
    }

    function addKey(varIdx: number) {
        const updated = [...variations]
        updated[varIdx] = {
            ...updated[varIdx],
            variables: [...updated[varIdx].variables, { key: '', value: '' }],
        }
        onChange(updated)
    }

    function removeKey(varIdx: number, keyIdx: number) {
        const updated = [...variations]
        updated[varIdx] = {
            ...updated[varIdx],
            variables: updated[varIdx].variables.filter((_, index) => index !== keyIdx),
        }
        onChange(updated)
    }

    function updateKey(varIdx: number, keyIdx: number, newKey: string) {
        const updated = [...variations]
        const variables: PromptVariable = updated[varIdx].variables.map((variable, index) =>
            index === keyIdx ? { ...variable, key: newKey } : variable,
        )
        updated[varIdx] = { ...updated[varIdx], variables }
        onChange(updated)
    }

    function updateValue(varIdx: number, keyIdx: number, value: string) {
        const updated = [...variations]
        updated[varIdx] = {
            ...updated[varIdx],
            variables: updated[varIdx].variables.map((variable, index) =>
                index === keyIdx ? { ...variable, value } : variable,
            ),
        }
        onChange(updated)
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = ids.indexOf(active.id)
        const newIndex = ids.indexOf(over.id)
        if (oldIndex < 0 || newIndex < 0) return

        onChange(arrayMove(variations, oldIndex, newIndex))
    }

    return (
        <div className="flex flex-col gap-3">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                        {variations.map((variation, varIdx) => (
                            <SortableVariation
                                key={itemId(variation, varIdx)}
                                id={itemId(variation, varIdx)}
                                variation={variation}
                                varIdx={varIdx}
                                onAddKey={addKey}
                                onRemoveVariation={removeVariation}
                                onRemoveKey={removeKey}
                                onUpdateKey={updateKey}
                                onUpdateValue={updateValue}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            <Button
                variant="outline"
                size="sm"
                className="gap-1.5 self-start"
                onClick={addVariation}
            >
                <Plus className="h-3.5 w-3.5" />
                변수 세트 추가
            </Button>
        </div>
    )
}

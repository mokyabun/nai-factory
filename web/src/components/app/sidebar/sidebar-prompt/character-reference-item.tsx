import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterReference, CharacterReferencePatch } from '@nai-factory/shared'
import { GripVertical, Trash2 } from 'lucide-react'
import { useCallback } from 'react'

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
import { useAutosave } from '@/hooks/use-autosave'
import { assetUrl } from '@/lib/api'

const REFERENCE_MODES = [
    { value: 'character&style', label: '캐릭터+스타일' },
    { value: 'character', label: '캐릭터' },
    { value: 'style', label: '스타일' },
] as const

type ReferenceMode = (typeof REFERENCE_MODES)[number]['value']

interface SortableCharacterReferenceItemProps {
    reference: CharacterReference
    onUpdate: (id: number, patch: CharacterReferencePatch) => Promise<unknown>
    onDelete: (id: number) => void
}

export function SortableCharacterReferenceItem({
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

    const save = useCallback(
        (patch: CharacterReferencePatch) => onUpdate(reference.id, patch),
        [onUpdate, reference.id],
    )
    const draft = useAutosave<CharacterReference, CharacterReferencePatch>({
        data: reference,
        save,
        delay: 400,
    })
    const { strength, fidelity, mode: referenceMode, enabled } = draft.value ?? reference

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    function handleStrengthChange(value: number) {
        draft.update({ strength: value })
    }

    function handleFidelityChange(value: number) {
        draft.update({ fidelity: value })
    }

    function handleReferenceModeChange(value: string | null) {
        if (!value) return
        draft.update({ mode: value as ReferenceMode }, { immediate: true })
    }

    function handleEnabledChange(value: boolean) {
        draft.update({ enabled: value }, { immediate: true })
    }

    const previewAssetId = reference.thumbAssetId ?? reference.sourceAssetId

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col gap-3 rounded-md border p-2">
            <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
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
                        src={assetUrl(previewAssetId)}
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
                            <SelectTrigger className="w-full">
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

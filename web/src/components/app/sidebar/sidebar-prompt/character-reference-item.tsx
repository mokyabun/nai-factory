import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterReference, CharacterReferencePatch } from '@nai-factory/shared'
import { GripVertical, Trash2 } from 'lucide-react'
import { useCallback } from 'react'

import { formatRatio, LabeledSlider, SelectField, ToggleRow } from '@/components/app/form-fields'
import { Button } from '@/components/ui/button'
import { useAutosave } from '@/hooks/use-autosave'
import { assetUrl } from '@/lib/api'

const REFERENCE_MODES = [
    { value: 'character&style', label: '캐릭터+스타일' },
    { value: 'character', label: '캐릭터' },
    { value: 'style', label: '스타일' },
] as const

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
                    <ToggleRow
                        compact
                        label="사용"
                        checked={enabled}
                        onChange={(value) => draft.update({ enabled: value }, { immediate: true })}
                    />
                    <SelectField
                        compact
                        label="모드"
                        value={referenceMode}
                        options={REFERENCE_MODES}
                        onChange={(mode) => draft.update({ mode }, { immediate: true })}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <LabeledSlider
                    compact
                    label="강도"
                    value={strength}
                    min={0}
                    max={1}
                    step={0.01}
                    format={formatRatio}
                    onChange={(value) => draft.update({ strength: value })}
                />
                <LabeledSlider
                    compact
                    label="충실도"
                    value={fidelity}
                    min={0}
                    max={1}
                    step={0.01}
                    format={formatRatio}
                    onChange={(value) => draft.update({ fidelity: value })}
                />
            </div>
        </div>
    )
}

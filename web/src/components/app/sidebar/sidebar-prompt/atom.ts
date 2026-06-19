import type {
    CharacterReference,
    Project,
    Parameters as ProjectParams,
    PromptVariable,
    VibeTransfer,
} from '@nai-factory/shared'
import { atom } from 'jotai'
import { type OrderPatch, reorderById } from '@/lib/reorder'

export type ProjectPromptData = Pick<
    Project,
    'id' | 'prompt' | 'negativePrompt' | 'variables' | 'parameters'
>

export type SidebarPromptDraft = {
    loadedProjectId: number | null
    prompt: string
    negativePrompt: string
    variables: PromptVariable
}

export type CharacterReferenceItemDraft = Pick<
    CharacterReference,
    'strength' | 'fidelity' | 'referenceMode' | 'enabled'
>

export type VibeTransferItemDraft = Pick<VibeTransfer, 'referenceStrength' | 'informationExtracted'>

export const sidebarPromptDraftAtom = atom<SidebarPromptDraft>({
    loadedProjectId: null,
    prompt: '',
    negativePrompt: '',
    variables: [],
})

export const sidebarParameterParamsAtom = atom<ProjectParams | null>(null)
export const vibeTransferItemsAtom = atom<VibeTransfer[]>([])
export const characterReferenceItemsAtom = atom<CharacterReference[]>([])
export const vibeTransferItemDraftAtom = atom<VibeTransferItemDraft | null>(null)
export const characterReferenceItemDraftAtom = atom<CharacterReferenceItemDraft | null>(null)

export function createSidebarPromptDraft(project: ProjectPromptData): SidebarPromptDraft {
    return {
        loadedProjectId: project.id,
        prompt: project.prompt ?? '',
        negativePrompt: project.negativePrompt ?? '',
        variables: project.variables ?? [],
    }
}

export function createVibeTransferItemDraft(vibe: VibeTransfer): VibeTransferItemDraft {
    return {
        referenceStrength: vibe.referenceStrength,
        informationExtracted: vibe.informationExtracted,
    }
}

export function createCharacterReferenceItemDraft(
    reference: CharacterReference,
): CharacterReferenceItemDraft {
    return {
        strength: reference.strength,
        fidelity: reference.fidelity,
        referenceMode: reference.referenceMode,
        enabled: reference.enabled,
    }
}

export function reorderItems<T extends { id: number }>(
    items: T[],
    activeId: number,
    overId: number,
): { items: T[]; orderPatch: OrderPatch } | null {
    return reorderById(items, activeId, overId)
}

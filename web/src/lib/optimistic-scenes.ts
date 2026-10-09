import type { PromptVariable, SceneSummary } from '@nai-factory/shared'

import { tempId } from './optimistic'

type SceneDraft = { name: string; variations: { variables: PromptVariable }[] }

/** Placeholder summaries shown while imported scenes are being created. */
export function optimisticSceneSummaries(projectId: number, items: SceneDraft[]): SceneSummary[] {
    const now = new Date().toISOString()
    return items.map((item, index) => {
        const sceneId = tempId()
        return {
            id: sceneId,
            projectId,
            // `~` sorts after the server's fractional keys, so placeholders stay at the end.
            position: `~${String(index).padStart(6, '0')}`,
            name: item.name,
            variations: item.variations.map((variation, variationIndex) => ({
                id: tempId(),
                sceneId,
                position: String(variationIndex).padStart(6, '0'),
                variables: variation.variables,
                createdAt: now,
                updatedAt: now,
            })),
            createdAt: now,
            updatedAt: now,
            imageCount: 0,
            queueCount: 0,
            latestImages: [],
        }
    })
}

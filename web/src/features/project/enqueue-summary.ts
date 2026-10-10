import { isFreeGeneration, type Parameters } from '@nai-factory/shared'

export const LARGE_ENQUEUE_IMAGE_COUNT = 200

type SizeParameters = Pick<Parameters, 'width' | 'height' | 'steps'>

export interface EnqueueSummary {
    sceneCount: number
    variationCount: number
    imagesPerVariation: number
    total: number
    paid: boolean
}

export function summarizeSceneEnqueue(
    scenes: readonly { variations: readonly unknown[] }[],
    imagesPerVariation: number,
    parameters: SizeParameters | undefined,
): EnqueueSummary {
    const variationCount = scenes.reduce((sum, scene) => sum + scene.variations.length, 0)
    return {
        sceneCount: scenes.length,
        variationCount,
        imagesPerVariation,
        total: variationCount * imagesPerVariation,
        paid: parameters !== undefined && !isFreeGeneration(parameters),
    }
}

export function needsEnqueueConfirmation(summary: EnqueueSummary) {
    return summary.total > LARGE_ENQUEUE_IMAGE_COUNT
}

export function describeEnqueueTotal(summary: EnqueueSummary) {
    const { sceneCount, variationCount, imagesPerVariation, total } = summary
    return `씬 ${sceneCount}개 × 변수 세트 ${variationCount}개 × ${imagesPerVariation}장 = ${total}장`
}

export function describeEnqueueCost(summary: EnqueueSummary) {
    return summary.paid ? `${summary.total}장 중 ${summary.total}장이 Anlas를 소모합니다` : null
}

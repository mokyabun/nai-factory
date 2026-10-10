import {
    DEFAULT_PLAYGROUND_PARAMETERS,
    Parameters,
    type PlaygroundImage,
    type PlaygroundJobPayload,
    type PlaygroundState,
    type PlaygroundStatePatch,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { badRequest, requireEntity } from '@/lib/http'
import { deepMerge } from '@/lib/merge'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'

import * as repo from './repo'

const DEFAULT_IMAGE_LIMIT = 30

function toState(row: repo.StateRow): PlaygroundState {
    return {
        prompt: row.prompt,
        negativePrompt: row.negativePrompt,
        characterPrompts: row.characterPrompts,
        parameters: Parameters.parse(row.parameters),
        updatedAt: toIso(row.updatedAt),
    }
}

function toImage(row: repo.ImageRow): PlaygroundImage {
    return {
        id: row.id,
        assetId: row.assetId,
        thumbAssetId: row.thumbAssetId,
        prompt: row.prompt,
        negativePrompt: row.negativePrompt,
        characterPrompts: row.characterPrompts,
        parameters: row.parameters,
        seed: row.seed,
        metadata: row.metadata,
        createdAt: toIso(row.createdAt),
    }
}

function loadState(db: DbOrTx) {
    return (
        repo.getState(db) ??
        repo.saveState(db, {
            prompt: '',
            negativePrompt: '',
            characterPrompts: [],
            parameters: DEFAULT_PLAYGROUND_PARAMETERS,
        })
    )
}

export function getState(ctx: AppContext) {
    return toState(loadState(ctx.db))
}

export function mergeSnapshot(
    base: PlaygroundJobPayload,
    patch: PlaygroundStatePatch,
): PlaygroundJobPayload {
    const merged = deepMerge(base, patch)
    const parameters = Parameters.safeParse(merged.parameters)
    if (!parameters.success) throw badRequest('Invalid parameters', parameters.error.issues)
    return {
        prompt: merged.prompt,
        negativePrompt: merged.negativePrompt,
        characterPrompts: merged.characterPrompts,
        parameters: parameters.data,
    }
}

export function updateState(ctx: AppContext, patch: PlaygroundStatePatch) {
    return ctx.db.transaction((tx) => {
        const current = toState(loadState(tx))
        return toState(repo.saveState(tx, mergeSnapshot(current, patch)))
    })
}

export function listImages(ctx: AppContext, limit = DEFAULT_IMAGE_LIMIT) {
    return repo.listImages(ctx.db, limit).map(toImage)
}

export function insertImage(tx: DbOrTx, values: repo.ImageInsert) {
    return repo.insertImage(tx, values)
}

export async function removeImage(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        const row = requireEntity(repo.getImage(tx, id), 'Playground image')
        repo.removeImage(tx, id)
        return assets.deleteUnreferenced(tx, [row.assetId, row.thumbAssetId])
    })
    await assets.removeFiles(ctx, removedPaths)
    ctx.events.publish({ type: 'playground.images.changed' })
}

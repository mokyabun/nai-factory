import {
    STASH_PAYLOADS,
    type StashApplyBody,
    type StashApplyResult,
    type StashCaptureScenesBody,
    type StashCreateBody,
    StashItem,
    type StashPatch,
    type StashScenePayload,
    type StashType,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import { badRequest, requireEntity } from '@/lib/http'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as projects from '@/modules/projects/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

/** Validates stored payloads against the entity schema of their type. */
function toEntity(row: repo.StashRow): StashItem {
    return StashItem.parse({
        id: row.id,
        type: row.type,
        name: row.name,
        payload: row.payload,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    })
}

export function list(ctx: AppContext, type?: StashType) {
    return repo.list(ctx.db, type).map(toEntity)
}

export function get(ctx: AppContext, id: number) {
    return toEntity(requireEntity(repo.getById(ctx.db, id), 'Stash item'))
}

export function create(ctx: AppContext, body: StashCreateBody) {
    return toEntity(
        repo.insert(ctx.db, { type: body.type, name: body.name, payload: body.payload }),
    )
}

export function update(ctx: AppContext, id: number, patch: StashPatch) {
    return ctx.db.transaction((tx) => {
        const current = requireEntity(repo.getById(tx, id), 'Stash item')
        const values: Parameters<typeof repo.update>[2] = {}
        if (patch.name !== undefined) values.name = patch.name
        if (patch.payload !== undefined) {
            const parsed = STASH_PAYLOADS[current.type].safeParse(patch.payload)
            if (!parsed.success) throw badRequest('Invalid stash payload', parsed.error.issues)
            values.payload = parsed.data
        }
        return toEntity(requireEntity(repo.update(tx, id, values), 'Stash item'))
    })
}

export function remove(ctx: AppContext, id: number) {
    requireEntity(repo.getById(ctx.db, id), 'Stash item')
    repo.remove(ctx.db, id)
}

export async function apply(
    ctx: AppContext,
    id: number,
    body: StashApplyBody,
): Promise<StashApplyResult> {
    const item = get(ctx, id)
    const mode = body.mode ?? 'append'

    const result = ctx.db.transaction((tx) => {
        if (item.type === 'prompt') {
            projects.applyPatch(tx, body.projectId, {
                prompt: item.payload.prompt,
                negativePrompt: item.payload.negativePrompt,
                variables: item.payload.variables,
                characterPrompts: item.payload.characterPrompts,
            })
            return { applied: true, removedPaths: [] as string[] }
        }
        if (item.type === 'parameters') {
            projects.applyPatch(tx, body.projectId, { parameters: item.payload })
            return { applied: true, removedPaths: [] as string[] }
        }
        const imported = scenes.importScenes(tx, body.projectId, item.payload.scenes, mode)
        return { applied: true, imported: imported.imported, removedPaths: imported.removedPaths }
    })

    if (item.type === 'scene' && mode === 'replace') ctx.scheduler.reconcile()
    await assets.removeFiles(ctx, result.removedPaths)
    return 'imported' in result ? { applied: true, imported: result.imported } : { applied: true }
}

export function captureScenes(ctx: AppContext, body: StashCaptureScenesBody): StashScenePayload {
    return scenes.exportJson(ctx, body)
}

import type { Image, ImageMetadata, MoveBody } from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { requireEntity } from '@/lib/http'
import { keyBefore, planMove } from '@/lib/order'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

export function toEntity(row: repo.ImageRow): Image {
    return {
        id: row.id,
        sceneId: row.sceneId,
        position: row.position,
        assetId: row.assetId,
        thumbAssetId: row.thumbAssetId,
        seed: row.seed,
        metadata: row.metadata,
        createdAt: toIso(row.createdAt),
    }
}

export function rowsByScene(db: DbOrTx, sceneId: number) {
    return repo.listByScene(db, sceneId)
}

export function list(ctx: AppContext, sceneId: number) {
    scenes.requireRow(ctx.db, sceneId)
    return repo.listByScene(ctx.db, sceneId).map(toEntity)
}

/** Records a generated image at the front of its scene. Runs inside the caller's transaction. */
export function insertGenerated(
    tx: DbOrTx,
    input: {
        sceneId: number
        assetId: number
        thumbAssetId: number
        seed: number | null
        metadata: ImageMetadata
    },
) {
    return repo.insert(tx, { ...input, position: keyBefore(repo.firstPosition(tx, input.sceneId)) })
}

export function insertRow(tx: DbOrTx, values: Parameters<typeof repo.insert>[1]) {
    return repo.insert(tx, values)
}

function publishChanged(ctx: AppContext, projectId: number, sceneId: number) {
    ctx.events.publish({ type: 'scene.images.changed', projectId, sceneId })
}

export function move(ctx: AppContext, id: number, body: MoveBody) {
    const { image, projectId } = ctx.db.transaction((tx) => {
        const found = requireEntity(repo.getWithProject(tx, id), 'Image')
        let updates
        try {
            updates = planMove(
                repo.listByScene(tx, found.image.sceneId),
                id,
                body.beforeId,
                body.afterId,
            )
        } catch (error) {
            throw scenes.moveError(error, 'Image')
        }
        for (const update of updates) repo.setPosition(tx, update.id, update.position)
        return { image: requireEntity(repo.getById(tx, id), 'Image'), projectId: found.projectId }
    })
    publishChanged(ctx, projectId, image.sceneId)
    return toEntity(image)
}

export async function remove(ctx: AppContext, id: number) {
    const { removedPaths, sceneId, projectId } = ctx.db.transaction((tx) => {
        const { image, projectId } = requireEntity(repo.getWithProject(tx, id), 'Image')
        repo.remove(tx, id)
        return {
            removedPaths: assets.deleteUnreferenced(tx, [image.assetId, image.thumbAssetId]),
            sceneId: image.sceneId,
            projectId,
        }
    })
    await assets.removeFiles(ctx, removedPaths)
    publishChanged(ctx, projectId, sceneId)
}

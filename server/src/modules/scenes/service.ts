import {
    type MoveBody,
    type Prompt,
    PromptVariable,
    type Scene,
    type SceneCreateBody,
    type SceneImportMode,
    type SceneJsonData,
    type SceneJsonExportBody,
    type SceneJsonFile,
    type SceneJsonScene,
    type ScenePatch,
    type ScenePreviewResult,
    type SceneSummary,
    type SceneVariation,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { badRequest, notFound, requireEntity } from '@/lib/http'
import { keyAfter, keysBetween, MoveError, planMove } from '@/lib/order'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as projects from '@/modules/projects/service'

import { compilePrompts, compileVariables, PromptRenderError } from './prompt'
import * as repo from './repo'

export { compilePrompts, compileVariables, PromptRenderError }
export type SceneRow = repo.SceneRow
export type VariationRow = repo.VariationRow

function toVariation(row: repo.VariationRow): SceneVariation {
    return {
        id: row.id,
        sceneId: row.sceneId,
        position: row.position,
        variables: PromptVariable.parse(row.variables),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

function groupVariations(rows: repo.VariationRow[]) {
    const byScene = new Map<number, SceneVariation[]>()
    for (const row of rows) {
        byScene.set(row.sceneId, [...(byScene.get(row.sceneId) ?? []), toVariation(row)])
    }
    return byScene
}

function toScene(row: repo.SceneRow, variations: SceneVariation[]): Scene {
    return {
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        position: row.position,
        variations,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

function toSummary(row: repo.SceneSummaryRow, variations: SceneVariation[]): SceneSummary {
    const latest = JSON.parse(row.latestImages) as repo.LatestImageRow[]
    return {
        ...toScene(row, variations),
        imageCount: row.imageCount,
        queueCount: row.queueCount,
        latestImages: latest.map((image) => ({
            id: image.id,
            position: image.position,
            assetId: image.assetId,
            thumbAssetId: image.thumbAssetId,
            createdAt: new Date(image.createdAt).toISOString(),
        })),
    }
}

export function requireRow(db: DbOrTx, id: number) {
    return requireEntity(repo.getById(db, id), 'Scene')
}

export function getRow(db: DbOrTx, id: number) {
    return repo.getById(db, id)
}

export function getVariationRow(db: DbOrTx, id: number) {
    return repo.getVariation(db, id)
}

export function variationRows(db: DbOrTx, sceneIds: number[]) {
    return repo.variationsByScene(db, sceneIds)
}

export function variationRowsByIds(db: DbOrTx, ids: number[]) {
    return repo.getVariationsByIds(db, ids)
}

export function sceneRows(db: DbOrTx, projectId: number) {
    return repo.listByProject(db, projectId)
}

export function list(ctx: AppContext, projectId: number): SceneSummary[] {
    projects.assertExists(ctx.db, projectId)
    const rows = repo.listSummaries(ctx.db, projectId)
    const variations = groupVariations(
        repo.variationsByScene(
            ctx.db,
            rows.map((row) => row.id),
        ),
    )
    return rows.map((row) => toSummary(row, variations.get(row.id) ?? []))
}

export function load(db: DbOrTx, id: number): Scene {
    const row = requireRow(db, id)
    return toScene(row, repo.variationsByScene(db, [id]).map(toVariation))
}

export function get(ctx: AppContext, id: number) {
    return load(ctx.db, id)
}

export function summary(ctx: AppContext, id: number) {
    const row = requireEntity(repo.getSummary(ctx.db, id), 'Scene')
    return toSummary(row, repo.variationsByScene(ctx.db, [id]).map(toVariation))
}

export function renderPrompts(
    ctx: AppContext,
    project: {
        prompt: string
        negativePrompt: string
        characterPrompts: Prompt['characterPrompts']
    },
    projectVariables: PromptVariable,
    variations: PromptVariable[],
) {
    return compilePrompts(
        {
            prompt: project.prompt,
            negativePrompt: project.negativePrompt,
            characterPrompts: project.characterPrompts,
        },
        compileVariables(ctx.settings.get().globalVariables, projectVariables, variations),
    )
}

export function preview(ctx: AppContext, id: number, variationId?: number): ScenePreviewResult {
    const scene = load(ctx.db, id)
    const project = projects.get(ctx, scene.projectId)
    const variations =
        variationId === undefined
            ? scene.variations
            : [
                  requireEntity(
                      scene.variations.find((variation) => variation.id === variationId),
                      'Variation',
                  ),
              ]

    try {
        return {
            ok: true,
            prompts: renderPrompts(
                ctx,
                project,
                project.variables,
                variations.map((variation) => variation.variables),
            ),
        }
    } catch (error) {
        return {
            ok: false,
            error: {
                message: error instanceof Error ? error.message : String(error),
                category: error instanceof PromptRenderError ? error.category : 'unknown',
            },
        }
    }
}

export function create(ctx: AppContext, body: SceneCreateBody) {
    return ctx.db.transaction((tx) => {
        projects.assertExists(tx, body.projectId)
        const row = repo.insert(tx, {
            projectId: body.projectId,
            name: body.name,
            position: keyAfter(repo.lastPosition(tx, body.projectId)),
        })
        return toScene(row, [])
    })
}

/** Positions are not unique, so reassigning them in list order never conflicts. */
export function syncVariations(tx: DbOrTx, sceneId: number, drafts: ScenePatch['variations'] & {}) {
    const existing = new Set(repo.variationsByScene(tx, [sceneId]).map((row) => row.id))
    const keep = new Set(
        drafts.map((draft) => draft.id).filter((id) => id !== undefined && existing.has(id)),
    )
    repo.deleteVariations(
        tx,
        [...existing].filter((id) => !keep.has(id)),
    )

    const positions = keysBetween(null, null, drafts.length)
    const inserts: { sceneId: number; position: string; variables: PromptVariable }[] = []
    const used = new Set<number>()
    for (const [index, draft] of drafts.entries()) {
        const position = positions[index] as string
        if (draft.id !== undefined && keep.has(draft.id) && !used.has(draft.id)) {
            used.add(draft.id)
            repo.updateVariation(tx, sceneId, draft.id, { variables: draft.variables, position })
        } else {
            inserts.push({ sceneId, position, variables: draft.variables })
        }
    }
    repo.insertVariations(tx, inserts)
}

export function update(ctx: AppContext, id: number, patch: ScenePatch) {
    const scene = ctx.db.transaction((tx) => {
        requireRow(tx, id)
        if (patch.name !== undefined) repo.update(tx, id, { name: patch.name })
        if (patch.variations !== undefined) {
            syncVariations(tx, id, patch.variations)
            repo.touch(tx, id)
        }
        return load(tx, id)
    })
    if (patch.variations !== undefined) ctx.scheduler.reconcile()
    return scene
}

export function moveError(error: unknown, what: string) {
    if (!(error instanceof MoveError)) return error
    return error.reason === 'not_found' ? notFound(what) : badRequest(error.message)
}

export function move(ctx: AppContext, id: number, body: MoveBody) {
    return ctx.db.transaction((tx) => {
        const row = requireRow(tx, id)
        const siblings = repo.listByProject(tx, row.projectId)
        let updates
        try {
            updates = planMove(siblings, id, body.beforeId, body.afterId)
        } catch (error) {
            throw moveError(error, 'Scene')
        }
        for (const update of updates) repo.setPosition(tx, update.id, update.position)
        return load(tx, id)
    })
}

export async function remove(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        requireRow(tx, id)
        const assetIds = repo.imageAssetIds(tx, [id])
        repo.remove(tx, [id])
        return assets.deleteUnreferenced(tx, assetIds)
    })
    ctx.scheduler.reconcile()
    await assets.removeFiles(ctx, removedPaths)
}

function insertScene(tx: DbOrTx, projectId: number, position: string, item: SceneJsonScene) {
    const scene = repo.insert(tx, { projectId, name: item.name, position })
    const positions = keysBetween(null, null, item.variations.length)
    repo.insertVariations(
        tx,
        item.variations.map((variation, index) => ({
            sceneId: scene.id,
            position: positions[index] as string,
            variables: variation.variables,
        })),
    )
    return scene
}

/** Inserts an archived scene with its original positions. */
export function insertImported(
    tx: DbOrTx,
    projectId: number,
    scene: {
        name: string
        position: string
        variations: { position: string; variables: PromptVariable }[]
    },
) {
    const row = repo.insert(tx, { projectId, name: scene.name, position: scene.position })
    repo.insertVariations(
        tx,
        scene.variations.map((variation) => ({ sceneId: row.id, ...variation })),
    )
    return row
}

export function duplicate(ctx: AppContext, id: number) {
    return ctx.db.transaction((tx) => {
        const source = load(tx, id)
        const copy = insertScene(
            tx,
            source.projectId,
            keyAfter(repo.lastPosition(tx, source.projectId)),
            {
                name: `${source.name} Copy`,
                variations: source.variations,
            },
        )
        return load(tx, copy.id)
    })
}

/** In `replace` mode the existing scenes go first; returned paths are removed after commit. */
export function importScenes(
    tx: DbOrTx,
    projectId: number,
    items: SceneJsonScene[],
    mode: SceneImportMode,
) {
    projects.assertExists(tx, projectId)
    let removedPaths: string[] = []
    if (mode === 'replace') {
        const existing = repo.listByProject(tx, projectId).map((row) => row.id)
        const assetIds = repo.imageAssetIds(tx, existing)
        repo.remove(tx, existing)
        removedPaths = assets.deleteUnreferenced(tx, assetIds)
    }

    const last = mode === 'replace' ? null : repo.lastPosition(tx, projectId)
    const positions = keysBetween(last, null, items.length)
    for (const [index, item] of items.entries()) {
        insertScene(tx, projectId, positions[index] as string, item)
    }
    return { imported: items.length, removedPaths }
}

/** Copies scenes and variations (not images) into another project. */
export function copyProjectScenes(tx: DbOrTx, fromProjectId: number, toProjectId: number) {
    const rows = repo.listByProject(tx, fromProjectId)
    const variations = groupVariations(
        repo.variationsByScene(
            tx,
            rows.map((row) => row.id),
        ),
    )
    for (const row of rows) {
        const copy = repo.insert(tx, {
            projectId: toProjectId,
            name: row.name,
            position: row.position,
        })
        repo.insertVariations(
            tx,
            (variations.get(row.id) ?? []).map((variation) => ({
                sceneId: copy.id,
                position: variation.position,
                variables: variation.variables,
            })),
        )
    }
}

export function normalizeSceneJson(data: SceneJsonData): SceneJsonScene[] {
    if (Array.isArray(data)) return data
    if ('scenes' in data) return data.scenes
    return [data]
}

export function exportJson(ctx: AppContext, body: SceneJsonExportBody): SceneJsonFile {
    projects.assertExists(ctx.db, body.projectId)
    const selected = body.sceneIds ? new Set(body.sceneIds) : null
    const rows = repo
        .listByProject(ctx.db, body.projectId)
        .filter((row) => !selected || selected.has(row.id))
    const variations = groupVariations(
        repo.variationsByScene(
            ctx.db,
            rows.map((row) => row.id),
        ),
    )
    return {
        scenes: rows.map((row) => ({
            name: row.name,
            variations: (variations.get(row.id) ?? []).map((variation) => ({
                variables: variation.variables,
            })),
        })),
    }
}

export async function importJson(
    ctx: AppContext,
    projectId: number,
    data: SceneJsonData,
    mode: SceneImportMode = 'append',
) {
    const items = normalizeSceneJson(data)
    const result = ctx.db.transaction((tx) => importScenes(tx, projectId, items, mode))
    if (mode === 'replace') ctx.scheduler.reconcile()
    await assets.removeFiles(ctx, result.removedPaths)
    ctx.log.info(
        { event: 'scene_json.imported', projectId, mode, imported: result.imported },
        'Scene JSON imported',
    )
    return { imported: result.imported }
}

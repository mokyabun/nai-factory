import {
    CharacterPrompt,
    DEFAULT_PROJECT_PARAMETERS,
    DEFAULT_PROJECT_SETTINGS,
    Parameters,
    type Project,
    type ProjectCreateBody,
    type ProjectDuplicateBody,
    type ProjectPatch,
    ProjectSettings,
    PromptVariable,
} from '@nai-factory/shared'
import * as z from 'zod'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { badRequest, notFound, requireEntity } from '@/lib/http'
import { deepMerge } from '@/lib/merge'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as groups from '@/modules/groups/service'
import * as references from '@/modules/references/service'
import * as scenes from '@/modules/scenes/service'

import * as repo from './repo'

export type ProjectRow = repo.ProjectRow

const CharacterPrompts = z.array(CharacterPrompt)

/** Parses the JSON columns with the entity schemas (filling defaults for missing fields). */
export function toEntity(row: repo.ProjectRow): Project {
    return {
        id: row.id,
        groupId: row.groupId,
        name: row.name,
        prompt: row.prompt,
        negativePrompt: row.negativePrompt,
        variables: PromptVariable.parse(row.variables),
        parameters: Parameters.parse(row.parameters),
        characterPrompts: CharacterPrompts.parse(row.characterPrompts),
        settings: ProjectSettings.parse(row.settings),
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

export function getRow(db: DbOrTx, id: number) {
    return repo.getById(db, id)
}

export function requireRow(db: DbOrTx, id: number) {
    return requireEntity(repo.getById(db, id), 'Project')
}

export function exists(db: DbOrTx, id: number) {
    return repo.exists(db, id)
}

export function assertExists(db: DbOrTx, id: number) {
    if (!repo.exists(db, id)) throw notFound('Project')
}

export function collectAssetIds(db: DbOrTx, projectIds: number[]) {
    return repo.assetIds(db, projectIds)
}

/** Inserts a project from an archive; settings and parameters are already validated. */
export function insertImported(
    tx: DbOrTx,
    values: Omit<repo.ProjectInsert, 'id' | 'groupId' | 'createdAt' | 'updatedAt'>,
) {
    return repo.insert(tx, { ...values, groupId: null })
}

export function list(ctx: AppContext, groupId?: number | 'none') {
    return repo.list(ctx.db, groupId).map(toEntity)
}

export function get(ctx: AppContext, id: number) {
    return toEntity(requireRow(ctx.db, id))
}

function assertGroup(db: DbOrTx, groupId: number | null | undefined) {
    if (groupId !== null && groupId !== undefined && !groups.exists(db, groupId)) {
        throw badRequest('Group not found')
    }
}

export function create(ctx: AppContext, body: ProjectCreateBody) {
    return ctx.db.transaction((tx) => {
        assertGroup(tx, body.groupId)
        const row = repo.insert(tx, {
            groupId: body.groupId,
            name: body.name,
            prompt: '',
            negativePrompt: '',
            characterPrompts: [],
            variables: [],
            parameters: DEFAULT_PROJECT_PARAMETERS,
            settings: DEFAULT_PROJECT_SETTINGS,
        })
        return toEntity(row)
    })
}

/** Applies a deep-merged patch and validates the merged project before saving. */
export function applyPatch(tx: DbOrTx, id: number, patch: ProjectPatch) {
    const current = toEntity(requireRow(tx, id))
    assertGroup(tx, patch.groupId)
    const merged = deepMerge(current, patch)

    const parsed = {
        parameters: Parameters.safeParse(merged.parameters),
        settings: ProjectSettings.safeParse(merged.settings),
    }
    if (!parsed.parameters.success) {
        throw badRequest('Invalid parameters', parsed.parameters.error.issues)
    }
    if (!parsed.settings.success) throw badRequest('Invalid settings', parsed.settings.error.issues)

    const row = repo.update(tx, id, {
        groupId: merged.groupId,
        name: merged.name,
        prompt: merged.prompt,
        negativePrompt: merged.negativePrompt,
        variables: merged.variables,
        characterPrompts: merged.characterPrompts,
        parameters: parsed.parameters.data,
        settings: parsed.settings.data,
    })
    return toEntity(requireEntity(row, 'Project'))
}

export function update(ctx: AppContext, id: number, patch: ProjectPatch) {
    return ctx.db.transaction((tx) => applyPatch(tx, id, patch))
}

export async function remove(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        requireRow(tx, id)
        const assetIds = repo.assetIds(tx, [id])
        repo.remove(tx, id)
        return assets.deleteUnreferenced(tx, assetIds)
    })
    ctx.scheduler.reconcile()
    await assets.removeFiles(ctx, removedPaths)
}

export function duplicate(ctx: AppContext, id: number, options: ProjectDuplicateBody) {
    return ctx.db.transaction((tx) => {
        const source = requireRow(tx, id)
        const { id: _, createdAt: __, updatedAt: ___, ...values } = source
        const copy = repo.insert(tx, { ...values, name: `${source.name} Copy` })
        if (options.scenes ?? true) scenes.copyProjectScenes(tx, id, copy.id)
        if (options.references ?? true) references.copyProjectReferences(tx, id, copy.id)
        return toEntity(copy)
    })
}

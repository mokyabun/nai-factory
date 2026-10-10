import type {
    Group,
    GroupCreateBody,
    GroupNode,
    GroupPatch,
    GroupTreeItem,
    ProjectSummary,
} from '@nai-factory/shared'

import type { AppContext } from '@/context'
import type { DbOrTx } from '@/db'
import { badRequest, notFound, requireEntity } from '@/lib/http'
import { toIso } from '@/lib/time'
import * as assets from '@/modules/assets/service'
import * as projects from '@/modules/projects/service'

import * as repo from './repo'

const UNGROUPED_NAME = '그룹 없음'

function toEntity(row: repo.GroupRow): Group {
    return {
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
    }
}

function buildTree(rows: repo.GroupRow[], summaries: ProjectSummary[]) {
    const nodes = new Map<number, GroupNode>(
        rows.map((row) => [row.id, { ...toEntity(row), type: 'group', projects: [], groups: [] }]),
    )
    const roots: GroupNode[] = []
    for (const node of nodes.values()) {
        const parent = node.parentId === null ? undefined : nodes.get(node.parentId)
        if (parent) parent.groups.push(node)
        else roots.push(node)
    }

    const ungrouped: ProjectSummary[] = []
    for (const project of summaries) {
        if (project.groupId === null) ungrouped.push(project)
        else nodes.get(project.groupId)?.projects.push(project)
    }
    return { nodes, roots, ungrouped }
}

/** Ids of every group below `rootId` (not including it). */
export function descendantIds(rows: Pick<repo.GroupRow, 'id' | 'parentId'>[], rootId: number) {
    const children = new Map<number, number[]>()
    for (const row of rows) {
        if (row.parentId === null) continue
        children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id])
    }

    const result: number[] = []
    const stack = [...(children.get(rootId) ?? [])]
    const seen = new Set<number>()
    while (stack.length > 0) {
        const id = stack.pop() as number
        if (seen.has(id)) continue
        seen.add(id)
        result.push(id)
        stack.push(...(children.get(id) ?? []))
    }
    return result
}

export function exists(db: DbOrTx, id: number) {
    return repo.getById(db, id) !== null
}

export function tree(ctx: AppContext): GroupTreeItem[] {
    const { roots, ungrouped } = buildTree(repo.list(ctx.db), repo.projectSummaries(ctx.db))
    if (ungrouped.length === 0) return roots
    return [{ type: 'ungrouped', id: null, name: UNGROUPED_NAME, projects: ungrouped }, ...roots]
}

export function get(ctx: AppContext, id: number): GroupNode {
    const { nodes } = buildTree(repo.list(ctx.db), repo.projectSummaries(ctx.db))
    return requireEntity(nodes.get(id), 'Group')
}

export function create(ctx: AppContext, body: GroupCreateBody) {
    return ctx.db.transaction((tx) => {
        const parentId = body.parentId ?? null
        if (parentId !== null && !repo.getById(tx, parentId)) {
            throw badRequest('Parent group not found')
        }
        return toEntity(repo.insert(tx, { parentId, name: body.name }))
    })
}

export function update(ctx: AppContext, id: number, patch: GroupPatch) {
    return ctx.db.transaction((tx) => {
        requireEntity(repo.getById(tx, id), 'Group')
        if (patch.parentId !== undefined && patch.parentId !== null) {
            if (patch.parentId === id) throw badRequest('A group cannot be its own parent')
            const rows = repo.list(tx)
            if (!rows.some((row) => row.id === patch.parentId)) {
                throw badRequest('Parent group not found')
            }
            if (descendantIds(rows, id).includes(patch.parentId)) {
                throw badRequest('A group cannot be moved below its descendant')
            }
        }
        const updated = repo.update(tx, id, {
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.parentId !== undefined ? { parentId: patch.parentId } : {}),
        })
        return toEntity(requireEntity(updated, 'Group'))
    })
}

export async function remove(ctx: AppContext, id: number) {
    const removedPaths = ctx.db.transaction((tx) => {
        if (!repo.getById(tx, id)) throw notFound('Group')
        const groupIds = [id, ...descendantIds(repo.list(tx), id)]
        const projectIds = repo.projectIdsInGroups(tx, groupIds)
        const assetIds = projects.collectAssetIds(tx, projectIds)
        repo.remove(tx, id)
        return assets.deleteUnreferenced(tx, assetIds)
    })
    ctx.scheduler.reconcile()
    await assets.removeFiles(ctx, removedPaths)
}

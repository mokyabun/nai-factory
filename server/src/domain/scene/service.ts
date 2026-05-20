import { asc, desc, eq, sql } from 'drizzle-orm'
import { status } from 'elysia'
import { db, images, projects, scenes, vibeTransfers } from '../../db'
import { compilePrompts, compileVariables, get as getSettings, removeByScene } from '../../services'
import { displayOrderBetween, nextDisplayOrder, requireEntity, withUpdatedAt } from '../../shared'
import type { PromptVariable } from '../../types'

type LatestImage = {
    id: number
    filePath: string
    thumbnailPath: string | null
}

const sceneSummaryColumns = {
    id: scenes.id,
    projectId: scenes.projectId,
    displayOrder: scenes.displayOrder,
    name: scenes.name,
    variations: scenes.variations,
    createdAt: scenes.createdAt,
    updatedAt: scenes.updatedAt,
    imageCount: sql<number>`(select count(*) from images where images.scene_id = scenes.id)`,
    queueCount: sql<number>`(select count(*) from queue_items where queue_items.scene_id = scenes.id)`,
    latestImages: sql<string | null>`(
        select json_group_array(json_object(
            'id', i.id,
            'filePath', i.file_path,
            'thumbnailPath', i.thumbnail_path
        ))
        from (
            select id, file_path, thumbnail_path
            from images
            where scene_id = scenes.id
            order by display_order desc
            limit 10
        ) i
    )`,
} as const

function parseRow<T extends { latestImages: string | null }>(row: T) {
    return {
        ...row,
        latestImages: JSON.parse(row.latestImages ?? '[]') as LatestImage[],
    }
}

async function getProject(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function getScene(id: number) {
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    return requireEntity(scene, 'Scene not found')
}

async function getLastSceneOrder(projectId: number) {
    const [last] = await db
        .select({ displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(desc(scenes.displayOrder))
        .limit(1)

    return last?.displayOrder ?? null
}

async function getSiblingOrder(id: number, projectId: number, label: string) {
    const [scene] = await db
        .select({ projectId: scenes.projectId, displayOrder: scenes.displayOrder })
        .from(scenes)
        .where(eq(scenes.id, id))

    const sibling = requireEntity(scene, `${label} scene not found`)
    if (sibling.projectId !== projectId)
        throw status(400, `${label} scene belongs to another project`)

    return sibling.displayOrder
}

export async function get(projectId: number) {
    await getProject(projectId)

    const rows = await db
        .select(sceneSummaryColumns)
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder), asc(scenes.id))

    return rows.map(parseRow)
}

export async function getSummary(id: number) {
    const [scene] = await db.select(sceneSummaryColumns).from(scenes).where(eq(scenes.id, id))

    return parseRow(requireEntity(scene, 'Scene not found'))
}

export async function getById(id: number) {
    const scene = await getScene(id)

    const sceneImages = await db
        .select()
        .from(images)
        .where(eq(images.sceneId, id))
        .orderBy(desc(images.displayOrder))

    return { ...scene, images: sceneImages }
}

export async function getWorkspaceData(sceneId: number) {
    const { projectId } = await getScene(sceneId)
    const proj = await getProject(projectId)

    const vibeList = await db
        .select({
            id: vibeTransfers.id,
            projectId: vibeTransfers.projectId,
            displayOrder: vibeTransfers.displayOrder,
            sourceImagePath: vibeTransfers.sourceImagePath,
            referenceStrength: vibeTransfers.referenceStrength,
            informationExtracted: vibeTransfers.informationExtracted,
            createdAt: vibeTransfers.createdAt,
            updatedAt: vibeTransfers.updatedAt,
        })
        .from(vibeTransfers)
        .where(eq(vibeTransfers.projectId, projectId))
        .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id))

    return { ...proj, vibeTransfers: vibeList }
}

export async function getPreviewPrompts(id: number, variationId?: number) {
    const scene = await getScene(id)
    const project = await getProject(scene.projectId)
    const globalSettings = getSettings()

    let variationList = scene.variations
    if (variationId !== undefined) {
        const single = variationList[variationId]
        if (!single) throw status(404, 'Variation not found')
        variationList = [single]
    }

    const compiledVars = compileVariables(
        globalSettings.globalVariables,
        project.variables,
        variationList,
    )

    return compilePrompts(
        {
            prompt: project.prompt,
            negativePrompt: project.negativePrompt,
            characterPrompts: project.characterPrompts,
        },
        compiledVars,
    )
}

export async function create(projectId: number, name: string) {
    await getProject(projectId)

    const displayOrder = nextDisplayOrder(await getLastSceneOrder(projectId))
    const [created] = await db.insert(scenes).values({ projectId, name, displayOrder }).returning()

    return created
}

export async function update(id: number, body: { name?: string; variations?: PromptVariable[] }) {
    await getScene(id)

    const [updated] = await db
        .update(scenes)
        .set(withUpdatedAt(body))
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

export async function reorder(id: number, prevId: number | null, nextId: number | null) {
    const scene = await getScene(id)
    const prevOrder = prevId ? await getSiblingOrder(prevId, scene.projectId, 'Previous') : null
    const nextOrder = nextId ? await getSiblingOrder(nextId, scene.projectId, 'Next') : null

    const displayOrder = displayOrderBetween(prevOrder, nextOrder)
    const [updated] = await db
        .update(scenes)
        .set(withUpdatedAt({ displayOrder }))
        .where(eq(scenes.id, id))
        .returning()

    return updated
}

export async function remove(id: number) {
    const scene = await getScene(id)

    await db.delete(scenes).where(eq(scenes.id, id))
    await removeByScene(scene.projectId, scene.id)

    return { success: true }
}

export async function duplicate(id: number) {
    const scene = await getScene(id)
    const displayOrder = nextDisplayOrder(await getLastSceneOrder(scene.projectId))
    const [created] = await db
        .insert(scenes)
        .values({
            projectId: scene.projectId,
            name: `${scene.name} (copy)`,
            displayOrder,
            variations: scene.variations,
        })
        .returning()

    return created
}

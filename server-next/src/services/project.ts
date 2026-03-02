import { asc, desc, eq, inArray } from 'drizzle-orm'
import { generateKeyBetween } from 'fractional-indexing-jittered'
import { characterPrompts, db, groups, images, projects, scenes, vibeTransfers } from '@/db'
import type { Parameters, PromptVariable } from '@/types'

export async function listProjects(groupId?: number) {
    const query = groupId
        ? db.select().from(projects).where(eq(projects.groupId, groupId))
        : db.select().from(projects)

    return query.orderBy(asc(projects.displayOrder), asc(projects.id))
}

export async function getProjectById(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id))
    return project ?? null
}

export async function createProject(groupId: number, name: string) {
    // Verify group exists
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId))
    if (!group) return null

    const [last] = await db
        .select({ displayOrder: projects.displayOrder })
        .from(projects)
        .where(eq(projects.groupId, groupId))
        .orderBy(desc(projects.displayOrder))
        .limit(1)

    const displayOrder = generateKeyBetween(last?.displayOrder ?? null, null)
    const [created] = await db.insert(projects).values({ groupId, name, displayOrder }).returning()
    return created!
}

export async function updateProject(
    id: number,
    data: {
        name?: string
        prompt?: string
        negativePrompt?: string
        parameters?: Partial<Parameters>
        variables?: PromptVariable
    },
) {
    const [existing] = await db.select().from(projects).where(eq(projects.id, id))
    if (!existing) return null

    const { parameters, variables, ...rest } = data

    const [updated] = await db
        .update(projects)
        .set({
            ...rest,
            ...(parameters !== undefined && {
                parameters: { ...existing.parameters, ...parameters } as Parameters,
            }),
            ...(variables !== undefined && {
                variables: { ...existing.variables, ...variables },
            }),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, id))
        .returning()

    return updated!
}

export async function reorderProject(id: number, prevId: number | null, nextId: number | null) {
    let prevOrder: string | null = null
    let nextOrder: string | null = null

    if (prevId) {
        const [prev] = await db
            .select({ displayOrder: projects.displayOrder })
            .from(projects)
            .where(eq(projects.id, prevId))
        prevOrder = prev?.displayOrder ?? null
    }

    if (nextId) {
        const [next] = await db
            .select({ displayOrder: projects.displayOrder })
            .from(projects)
            .where(eq(projects.id, nextId))
        nextOrder = next?.displayOrder ?? null
    }

    const displayOrder = generateKeyBetween(prevOrder, nextOrder)

    const [updated] = await db
        .update(projects)
        .set({ displayOrder, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, id))
        .returning()

    return updated ?? null
}

export async function deleteProject(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id))
    if (!project) return false

    await db.delete(projects).where(eq(projects.id, id))
    // Cascade handles character_prompts, vibe_transfers, scenes, queue_items
    // TODO: delete vibe source images from filesystem
    // TODO: delete generated images via imageService

    return true
}

/**
 * Load project with related scenes, character prompts, vibe transfers, and recent images.
 */
export async function getWorkspaceData(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!project) return null

    const [projectScenes, projectCharPrompts, projectVibes] = await Promise.all([
        db
            .select()
            .from(scenes)
            .where(eq(scenes.projectId, projectId))
            .orderBy(asc(scenes.displayOrder), asc(scenes.id)),
        db
            .select()
            .from(characterPrompts)
            .where(eq(characterPrompts.projectId, projectId))
            .orderBy(asc(characterPrompts.displayOrder), asc(characterPrompts.id)),
        db
            .select({
                id: vibeTransfers.id,
                projectId: vibeTransfers.projectId,
                displayOrder: vibeTransfers.displayOrder,
                sourceImagePath: vibeTransfers.sourceImagePath,
                referenceStrength: vibeTransfers.referenceStrength,
                informationExtracted: vibeTransfers.informationExtracted,
                // Omit encodedData (large) from workspace payload
                createdAt: vibeTransfers.createdAt,
                updatedAt: vibeTransfers.updatedAt,
            })
            .from(vibeTransfers)
            .where(eq(vibeTransfers.projectId, projectId))
            .orderBy(asc(vibeTransfers.displayOrder), asc(vibeTransfers.id)),
    ])

    const sceneIds = projectScenes.map((s) => s.id)
    const recentImages =
        sceneIds.length > 0
            ? await db
                  .select()
                  .from(images)
                  .where(inArray(images.sceneId, sceneIds))
                  .orderBy(desc(images.displayOrder))
                  .limit(60)
            : []

    const imagesByScene = new Map<number, typeof recentImages>()
    for (const img of recentImages) {
        const arr = imagesByScene.get(img.sceneId) ?? []
        arr.push(img)
        imagesByScene.set(img.sceneId, arr)
    }

    return {
        project,
        characterPrompts: projectCharPrompts,
        vibeTransfers: projectVibes,
        scenes: projectScenes.map((s) => ({
            ...s,
            images: imagesByScene.get(s.id) ?? [],
        })),
    }
}

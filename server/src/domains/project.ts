import { zValidator } from '@hono/zod-validator'
import {
    DEFAULT_PROJECT_SETTINGS,
    ProjectGetQuery,
    ProjectIdParams,
    ProjectPatchBody,
    ProjectPostBody,
} from '@nai-factory/shared'
import { asc, eq, inArray, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, scenes, sceneVariations } from '../db'
import logger from '../logger'
import { removeByProject, removeCharacterReferencesByProject } from '../services'
import { requireEntity, withNormalizedVariables, withUpdatedAt } from '../utils'

const log = logger.child({ module: 'project-domain' })

function normalizeProject<T extends typeof projects.$inferSelect>(project: T) {
    const normalized = withNormalizedVariables(project)
    return {
        ...normalized,
        settings: {
            ...DEFAULT_PROJECT_SETTINGS,
            ...(normalized.settings ?? {}),
        },
    }
}

async function getAllByGroupId(groupId?: number | 'null' | 'ungrouped') {
    const rows = await db
        .select()
        .from(projects)
        .where(
            groupId === undefined
                ? undefined
                : groupId === 'null' || groupId === 'ungrouped'
                  ? isNull(projects.groupId)
                  : eq(projects.groupId, groupId),
        )
        .orderBy(asc(projects.id))

    return rows.map(normalizeProject)
}

async function getById(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return normalizeProject(requireEntity(project, 'Project not found'))
}

async function create(body: ProjectPostBody) {
    const [project] = await db.insert(projects).values(body).returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to create project' })
    log.debug({ projectId: project.id, groupId: project.groupId }, 'Project created')
    return normalizeProject(project)
}

async function update(projectId: number, body: ProjectPatchBody) {
    const current = body.settings ? await getById(projectId) : null
    const patch = current ? { ...body, settings: { ...current.settings, ...body.settings } } : body

    const [project] = await db
        .update(projects)
        .set(withUpdatedAt(patch as Partial<typeof projects.$inferInsert>))
        .where(eq(projects.id, projectId))
        .returning()

    const result = normalizeProject(requireEntity(project, 'Project not found'))
    log.debug({ projectId, fields: Object.keys(patch) }, 'Project updated')
    return result
}

async function remove(projectId: number) {
    await getById(projectId)
    await Promise.all([removeByProject(projectId), removeCharacterReferencesByProject(projectId)])
    await db.delete(projects).where(eq(projects.id, projectId))
    log.debug({ projectId }, 'Project deleted')
}

async function duplicate(projectId: number) {
    const source = await getById(projectId)
    const sourceScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))
    const sourceVariations =
        sourceScenes.length === 0
            ? []
            : await db
                  .select()
                  .from(sceneVariations)
                  .where(
                      inArray(
                          sceneVariations.sceneId,
                          sourceScenes.map((scene) => scene.id),
                      ),
                  )
                  .orderBy(asc(sceneVariations.sceneId), asc(sceneVariations.displayOrder))

    const [project] = await db
        .insert(projects)
        .values({
            groupId: source.groupId,
            name: `${source.name} Copy`,
            prompt: source.prompt,
            negativePrompt: source.negativePrompt,
            variables: source.variables,
            parameters: source.parameters,
            characterPrompts: source.characterPrompts,
            settings: source.settings,
        })
        .returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to duplicate project' })

    for (const sourceScene of sourceScenes) {
        const [scene] = await db
            .insert(scenes)
            .values({
                projectId: project.id,
                displayOrder: sourceScene.displayOrder,
                name: sourceScene.name,
            })
            .returning()
        if (!scene) throw new HTTPException(500, { message: 'Failed to duplicate scene' })

        const variations = sourceVariations.filter(
            (variation) => variation.sceneId === sourceScene.id,
        )
        if (variations.length > 0) {
            await db.insert(sceneVariations).values(
                variations.map((variation) => ({
                    sceneId: scene.id,
                    displayOrder: variation.displayOrder,
                    variables: variation.variables,
                })),
            )
        }
    }

    log.debug(
        {
            sourceProjectId: projectId,
            projectId: project.id,
            sceneCount: sourceScenes.length,
            variationCount: sourceVariations.length,
        },
        'Project duplicated',
    )

    return normalizeProject(project)
}

export const project = new Hono()
    .get('/', zValidator('query', ProjectGetQuery), async (c) => {
        const query = c.req.valid('query')
        return c.json(await getAllByGroupId(query.groupId))
    })
    .get('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await getById(c.req.valid('param').projectId))
    })
    .post('/', zValidator('json', ProjectPostBody), async (c) => {
        const body = c.req.valid('json')
        return c.json(await create(body), 201)
    })
    .patch(
        '/:projectId',
        zValidator('param', ProjectIdParams),
        zValidator('json', ProjectPatchBody),
        async (c) => {
            return c.json(await update(c.req.valid('param').projectId, c.req.valid('json')))
        },
    )
    .delete('/:projectId', zValidator('param', ProjectIdParams), async (c) => {
        await remove(c.req.valid('param').projectId)
        return c.body(null, 204)
    })
    .post('/:projectId/duplicate', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await duplicate(c.req.valid('param').projectId), 201)
    })

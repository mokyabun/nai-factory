import { zValidator } from '@hono/zod-validator'
import {
    ProjectGetQuery,
    ProjectIdParams,
    ProjectPatchBody,
    ProjectPostBody,
} from '@nai-factory/types'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { db, projects, scenes } from '../db'
import { removeByProject, removeCharacterReferencesByProject } from '../services'
import { requireEntity, withUpdatedAt } from '../shared'

async function getAllByGroupId(groupId: number) {
    return db.select().from(projects).where(eq(projects.groupId, groupId)).orderBy(asc(projects.id))
}

async function getById(projectId: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function create(body: ProjectPostBody) {
    const [project] = await db.insert(projects).values(body).returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to create project' })
    return project
}

async function update(projectId: number, body: ProjectPatchBody) {
    const [project] = await db
        .update(projects)
        .set(withUpdatedAt(body))
        .where(eq(projects.id, projectId))
        .returning()

    return requireEntity(project, 'Project not found')
}

async function remove(projectId: number) {
    await getById(projectId)
    await Promise.all([removeByProject(projectId), removeCharacterReferencesByProject(projectId)])
    await db.delete(projects).where(eq(projects.id, projectId))
}

async function duplicate(projectId: number) {
    const source = await getById(projectId)
    const sourceScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId))
        .orderBy(asc(scenes.displayOrder))

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
        })
        .returning()
    if (!project) throw new HTTPException(500, { message: 'Failed to duplicate project' })

    if (sourceScenes.length > 0) {
        await db.insert(scenes).values(
            sourceScenes.map((scene) => ({
                projectId: project.id,
                displayOrder: scene.displayOrder,
                name: scene.name,
                variations: scene.variations,
            })),
        )
    }

    return project
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

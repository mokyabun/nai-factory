import fs from 'node:fs/promises'
import { zValidator } from '@hono/zod-validator'
import {
    CharacterReferenceItemParams,
    CharacterReferenceOrderPatchBody,
    CharacterReferencePatchBody,
    CharacterReferenceUploadBody,
    ProjectIdParams,
} from '@nai-factory/shared'
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { CHARACTER_REFERENCES_DIR } from '@/config'
import { characterReferences, db, projects } from '@/db'
import logger from '@/logger'
import {
    deleteCharacterReferenceFiles,
    listCharacterReferences,
    uploadCharacterReference,
} from '@/services'
import { planDisplayOrderUpdate } from '@/services/order'
import { requireEntity, withUpdatedAt } from '@/shared'

const log = logger.child({ module: 'character-reference-domain' })

async function getProject(projectId: number) {
    const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
    return requireEntity(project, 'Project not found')
}

async function list(projectId: number) {
    await getProject(projectId)
    return listCharacterReferences(projectId)
}

async function upload(projectId: number, image: CharacterReferenceUploadBody['image']) {
    await getProject(projectId)
    const created = await uploadCharacterReference(projectId, image)
    log.info(
        { projectId, characterReferenceId: created.id },
        'Character reference uploaded',
    )
    return created
}

async function update(projectId: number, id: number, body: CharacterReferencePatchBody) {
    const [existing] = await db
        .select()
        .from(characterReferences)
        .where(eq(characterReferences.id, id))
    if (!existing) return null
    if (existing.projectId !== projectId) return null

    const [updated] = await db
        .update(characterReferences)
        .set(withUpdatedAt(body))
        .where(eq(characterReferences.id, id))
        .returning()

    if (updated) {
        log.info(
            { projectId, characterReferenceId: id, fields: Object.keys(body) },
            'Character reference updated',
        )
    }

    return updated ?? null
}

async function reorder(
    projectId: number,
    id: number,
    prevId: number | null,
    nextId: number | null,
) {
    const [existing] = await db
        .select({ projectId: characterReferences.projectId })
        .from(characterReferences)
        .where(eq(characterReferences.id, id))
    if (!existing) return null
    if (existing.projectId !== projectId) return null

    const items = await db
        .select({ id: characterReferences.id, displayOrder: characterReferences.displayOrder })
        .from(characterReferences)
        .where(eq(characterReferences.projectId, projectId))
        .orderBy(asc(characterReferences.displayOrder), asc(characterReferences.id))
    const plan = planDisplayOrderUpdate({
        entity: 'character reference',
        items,
        id,
        prevId,
        nextId,
        logContext: { projectId },
    })
    if (!plan) return null

    const updated = db.transaction(() => {
        if (plan.type === 'rebalance') {
            for (const update of plan.updates) {
                db.update(characterReferences)
                    .set(withUpdatedAt({ displayOrder: update.displayOrder }))
                    .where(eq(characterReferences.id, update.id))
                    .run()
            }
        } else {
            db.update(characterReferences)
                .set(withUpdatedAt({ displayOrder: plan.displayOrder }))
                .where(eq(characterReferences.id, id))
                .run()
        }

        return db.select().from(characterReferences).where(eq(characterReferences.id, id)).get()
    })

    if (updated) {
        log.info(
            { projectId, characterReferenceId: id, planType: plan.type },
            'Character reference reordered',
        )
    }

    return updated ?? null
}

async function remove(projectId: number, id: number) {
    const [existing] = await db
        .select()
        .from(characterReferences)
        .where(eq(characterReferences.id, id))
    if (!existing) return false
    if (existing.projectId !== projectId) return false

    await db.delete(characterReferences).where(eq(characterReferences.id, id))
    await deleteCharacterReferenceFiles(existing)

    try {
        await fs.rmdir(`${CHARACTER_REFERENCES_DIR}/${projectId}`)
    } catch {
        // Directory still contains other references, or it is already gone.
    }

    log.warn({ projectId, characterReferenceId: id }, 'Character reference deleted')
    return true
}

export const characterReference = new Hono()
    .get('/', zValidator('param', ProjectIdParams), async (c) => {
        return c.json(await list(c.req.valid('param').projectId))
    })
    .post(
        '/upload',
        zValidator('param', ProjectIdParams),
        zValidator('form', CharacterReferenceUploadBody),
        async (c) => {
            const { projectId } = c.req.valid('param')
            const { image } = c.req.valid('form')
            return c.json(await upload(projectId, image), 201)
        },
    )
    .patch(
        '/reorder',
        zValidator('param', ProjectIdParams),
        zValidator('json', CharacterReferenceOrderPatchBody),
        async (c) => {
            const { projectId } = c.req.valid('param')
            const { id, prevId, nextId } = c.req.valid('json')
            const result = await reorder(projectId, id, prevId, nextId)
            if (!result) throw new HTTPException(404, { message: 'Character reference not found' })

            return c.json(result)
        },
    )
    .patch(
        '/:id',
        zValidator('param', CharacterReferenceItemParams),
        zValidator('json', CharacterReferencePatchBody),
        async (c) => {
            const { projectId, id } = c.req.valid('param')
            const result = await update(projectId, id, c.req.valid('json'))
            if (!result) throw new HTTPException(404, { message: 'Character reference not found' })

            return c.json(result)
        },
    )
    .delete('/:id', zValidator('param', CharacterReferenceItemParams), async (c) => {
        const { projectId, id } = c.req.valid('param')
        if (!(await remove(projectId, id))) {
            throw new HTTPException(404, { message: 'Character reference not found' })
        }

        return c.body(null, 204)
    })

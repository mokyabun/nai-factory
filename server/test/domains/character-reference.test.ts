import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const tempDbPath = join(import.meta.dir, `character-reference-${Date.now()}.db`)
const tempImagePath = join(import.meta.dir, `character-reference-${Date.now()}.png`)
process.env.DATABASE_URL = tempDbPath

const [{ createApp }, dbModule] = await Promise.all([
    import('../../src/index'),
    import('../../src/db'),
])

const { characterReferences, db, groups, projects, scenes } = dbModule

beforeAll(async () => {
    await rm(tempImagePath, { force: true })
})

afterAll(async () => {
    await Promise.all([
        rm(tempImagePath, { force: true }),
        rm(tempDbPath, { force: true }),
        rm(`${tempDbPath}-shm`, { force: true }),
        rm(`${tempDbPath}-wal`, { force: true }),
    ])
})

async function seedProject() {
    const [group] = await db.insert(groups).values({ name: 'group' }).returning()
    if (!group) throw new Error('Failed to seed group')

    const [project] = await db
        .insert(projects)
        .values({ groupId: group.id, name: 'project' })
        .returning()

    if (!project) throw new Error('Failed to seed project')
    return project
}

async function seedCharacterReference(projectId: number) {
    await writeFile(tempImagePath, new Uint8Array([1, 2, 3]))

    const [ref] = await db
        .insert(characterReferences)
        .values({
            projectId,
            displayOrder: 'a0',
            sourceImagePath: tempImagePath,
            strength: 0.6,
            fidelity: 0.5,
            referenceMode: 'character&style',
        })
        .returning()

    if (!ref) throw new Error('Failed to seed character reference')
    return ref
}

describe('character reference domain', () => {
    const app = createApp()

    it('lists, updates, reorders, and deletes character references', async () => {
        const project = await seedProject()
        const ref = await seedCharacterReference(project.id)

        const listResponse = await app.request(`/projects/${project.id}/character-references`)
        expect(listResponse.status).toBe(200)
        expect(await listResponse.json()).toMatchObject([{ id: ref.id, strength: 0.6 }])

        const patchResponse = await app.request(
            `/projects/${project.id}/character-references/${ref.id}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strength: 0.8, enabled: false }),
            },
        )
        expect(patchResponse.status).toBe(200)
        expect(await patchResponse.json()).toMatchObject({
            id: ref.id,
            strength: 0.8,
            enabled: false,
        })

        const reorderResponse = await app.request(
            `/projects/${project.id}/character-references/reorder`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ref.id, prevId: null, nextId: null }),
            },
        )
        expect(reorderResponse.status).toBe(200)
        expect(await reorderResponse.json()).toMatchObject({ id: ref.id })

        const deleteResponse = await app.request(
            `/projects/${project.id}/character-references/${ref.id}`,
            { method: 'DELETE' },
        )
        expect(deleteResponse.status).toBe(204)

        const afterDeleteResponse = await app.request(
            `/projects/${project.id}/character-references`,
        )
        expect(await afterDeleteResponse.json()).toEqual([])
    })
})

describe('group domain', () => {
    const app = createApp()

    it('includes ungrouped projects in the project tree response', async () => {
        const [group] = await db.insert(groups).values({ name: 'group tree' }).returning()
        if (!group) throw new Error('Failed to seed group')

        const [groupedProject] = await db
            .insert(projects)
            .values({ groupId: group.id, name: 'grouped tree' })
            .returning()
        const [ungroupedProject] = await db
            .insert(projects)
            .values({ groupId: null, name: 'ungrouped tree' })
            .returning()
        if (!groupedProject || !ungroupedProject) throw new Error('Failed to seed projects')

        const response = await app.request('/groups')
        expect(response.status).toBe(200)

        const body = (await response.json()) as Array<{
            id: number | null
            type: string
            projects?: unknown[]
        }>
        const ungrouped = body.find((item: { type: string }) => item.type === 'ungrouped')
        if (!ungrouped) throw new Error('Expected ungrouped project tree item')
        expect(ungrouped).toMatchObject({
            type: 'ungrouped',
            id: null,
            name: '그룹 없음',
        })
        expect(ungrouped.projects).toContainEqual(
            expect.objectContaining({
                id: ungroupedProject.id,
                groupId: null,
                name: 'ungrouped tree',
            }),
        )

        const groupItem = body.find(
            (item: { id: number | null; type: string }) =>
                item.type === 'group' && item.id === group.id,
        )
        expect(groupItem).toMatchObject({
            type: 'group',
            id: group.id,
            projects: [{ id: groupedProject.id, groupId: group.id, name: 'grouped tree' }],
        })
    })

    it('lists ungrouped projects through the project domain query', async () => {
        const [project] = await db
            .insert(projects)
            .values({ groupId: null, name: 'ungrouped query' })
            .returning()
        if (!project) throw new Error('Failed to seed project')

        const response = await app.request('/projects?groupId=ungrouped')
        expect(response.status).toBe(200)

        const body = (await response.json()) as unknown[]
        expect(body).toContainEqual(
            expect.objectContaining({ id: project.id, groupId: null, name: 'ungrouped query' }),
        )
    })
})

describe('variable validation', () => {
    const app = createApp()

    it('rejects duplicate project variable keys', async () => {
        const project = await seedProject()

        const response = await app.request(`/projects/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                variables: [
                    { key: 'prompt', value: 'a' },
                    { key: 'prompt', value: 'b' },
                ],
            }),
        })

        expect(response.status).toBe(400)
    })

    it('rejects duplicate scene variation variable keys', async () => {
        const project = await seedProject()
        const [scene] = await db
            .insert(scenes)
            .values({ projectId: project.id, name: 'scene', displayOrder: 'a0' })
            .returning()
        if (!scene) throw new Error('Failed to seed scene')

        const response = await app.request(`/scenes/${scene.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                variations: [
                    {
                        variables: [
                            { key: 'prompt', value: 'a' },
                            { key: 'prompt', value: 'b' },
                        ],
                    },
                ],
            }),
        })

        expect(response.status).toBe(400)
    })
})

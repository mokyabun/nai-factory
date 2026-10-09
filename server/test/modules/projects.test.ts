import { afterAll, describe, expect, it } from 'bun:test'

import { contract } from '@nai-factory/shared'

import { createTestApp } from '../helpers/app'
import { createProject, createScene } from '../helpers/fixtures'

const t = await createTestApp()
afterAll(() => t.close())

describe('B3: partial updates keep the other fields', () => {
    it('merges project settings', async () => {
        const project = await createProject(t)
        await t.call(contract.projects.update, {
            params: { id: project.id },
            body: { settings: { slideshowImageCount: 8 } },
        })
        const updated = await t.call(contract.projects.update, {
            params: { id: project.id },
            body: { settings: { outputTemplate: '{scene}.{extension}' } },
        })
        expect(updated.settings).toEqual({
            slideshowImageCount: 8,
            sceneCardSize: 'md',
            outputTemplate: '{scene}.{extension}',
            defaultImageCount: 1,
        })
    })

    it('merges parameters and validates the result', async () => {
        const project = await createProject(t)
        const updated = await t.call(contract.projects.update, {
            params: { id: project.id },
            body: { parameters: { steps: 40 } },
        })
        expect(updated.parameters.steps).toBe(40)
        expect(updated.parameters.width).toBe(512)

        const invalid = await t.send(contract.projects.update, {
            params: { id: project.id },
            body: { parameters: { width: 100 } },
        })
        expect(invalid.status).toBe(400)
        expect(await invalid.json()).toMatchObject({ error: { code: 'validation_error' } })
    })

    it('keeps the NovelAI mode when another settings section changes', async () => {
        await t.call(contract.settings.update, { body: { novelai: { mode: 'fail' } } })
        await t.call(contract.settings.update, { body: { debug: { enabled: true } } })
        const settings = await t.call(contract.settings.get)
        expect(settings.novelai.mode).toBe('fail')
        expect(settings.debug).toEqual({ enabled: true, recentRequestLimit: 20 })
        await t.call(contract.settings.update, {
            body: { novelai: { mode: 'mock' }, debug: { enabled: false } },
        })
    })
})

describe('projects', () => {
    it('duplicates scenes and variations', async () => {
        const { projectId } = await createScene(t, { poses: ['a', 'b'] })
        const copy = await t.call(contract.projects.duplicate, {
            params: { id: projectId },
            body: {},
        })
        const scenes = await t.call(contract.scenes.list, { query: { projectId: copy.id } })
        expect(copy.name).toBe('project Copy')
        expect(scenes[0]?.variations.map((v) => v.variables[0]?.value)).toEqual(['a', 'b'])
    })

    it('lists ungrouped projects', async () => {
        const group = await t.call(contract.groups.create, { body: { name: 'g' } })
        const grouped = await t.call(contract.projects.create, {
            body: { groupId: group.id, name: 'in group' },
        })
        const ungrouped = await t.call(contract.projects.list, { query: { groupId: 'none' } })
        expect(ungrouped.some((project) => project.id === grouped.id)).toBe(false)
        const inGroup = await t.call(contract.projects.list, { query: { groupId: group.id } })
        expect(inGroup.map((project) => project.id)).toEqual([grouped.id])
    })
})

describe('groups', () => {
    it('refuses moving a group below its descendant', async () => {
        const parent = await t.call(contract.groups.create, { body: { name: 'parent' } })
        const child = await t.call(contract.groups.create, {
            body: { name: 'child', parentId: parent.id },
        })
        const response = await t.send(contract.groups.update, {
            params: { id: parent.id },
            body: { parentId: child.id },
        })
        expect(response.status).toBe(400)
    })

    it('deletes nested groups with their projects', async () => {
        const parent = await t.call(contract.groups.create, { body: { name: 'root' } })
        const child = await t.call(contract.groups.create, {
            body: { name: 'leaf', parentId: parent.id },
        })
        const project = await t.call(contract.projects.create, {
            body: { groupId: child.id, name: 'p' },
        })
        await t.call(contract.groups.delete, { params: { id: parent.id } })
        expect((await t.send(contract.projects.get, { params: { id: project.id } })).status).toBe(
            404,
        )
        expect((await t.send(contract.groups.get, { params: { id: child.id } })).status).toBe(404)
    })

    it('returns the tree with ungrouped projects first', async () => {
        const tree = await t.call(contract.groups.tree)
        expect(tree[0]?.type).toBe('ungrouped')
    })
})

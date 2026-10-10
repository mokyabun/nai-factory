import { afterAll, describe, expect, it } from 'bun:test'

import { contract } from '@nai-factory/shared'

import * as scenes from '@/modules/scenes/service'

import { createTestApp } from '../helpers/app'
import { createProject, createScene } from '../helpers/fixtures'

const t = await createTestApp()
afterAll(() => t.close())

const poses = (scene: { variations: { variables: { value: string }[] }[] }) =>
    scene.variations.map((variation) => variation.variables[0]?.value)

describe('B2: reordering and inserting variations', () => {
    it('swaps [A, B] → [B, A]', async () => {
        const { scene } = await createScene(t, { poses: ['A', 'B'] })
        const [a, b] = scene.variations
        const updated = await t.call(contract.scenes.update, {
            params: { id: scene.id },
            body: { variations: [b!, a!] },
        })
        expect(poses(updated)).toEqual(['B', 'A'])
        expect(updated.variations.map((v) => v.id)).toEqual([b!.id, a!.id])
    })

    it('inserts in the middle [A, new, B]', async () => {
        const { scene } = await createScene(t, { poses: ['A', 'B'] })
        const [a, b] = scene.variations
        const updated = await t.call(contract.scenes.update, {
            params: { id: scene.id },
            body: { variations: [a!, { id: -1, variables: [{ key: 'pose', value: 'new' }] }, b!] },
        })
        expect(poses(updated)).toEqual(['A', 'new', 'B'])
        expect(updated.variations[0]?.id).toBe(a!.id)
        expect(updated.variations[2]?.id).toBe(b!.id)
    })

    it('removes variations missing from the list', async () => {
        const { scene } = await createScene(t, { poses: ['A', 'B', 'C'] })
        const updated = await t.call(contract.scenes.update, {
            params: { id: scene.id },
            body: { variations: [scene.variations[2]!] },
        })
        expect(poses(updated)).toEqual(['C'])
    })
})

describe('scene order', () => {
    it('moves scenes with before/after neighbors', async () => {
        const project = await createProject(t)
        const ids = []
        for (const name of ['1', '2', '3']) {
            ids.push(
                (await t.call(contract.scenes.create, { body: { projectId: project.id, name } }))
                    .id,
            )
        }
        await t.call(contract.scenes.move, {
            params: { id: ids[2]! },
            body: { beforeId: null, afterId: ids[0]! },
        })
        const list = await t.call(contract.scenes.list, { query: { projectId: project.id } })
        expect(list.map((scene) => scene.name)).toEqual(['3', '1', '2'])
    })
})

describe('scene JSON', () => {
    it('exports selected scenes and imports them into another project', async () => {
        const { projectId, scene } = await createScene(t, { poses: ['sitting'] })
        const target = await createProject(t, 'target')
        const exported = await t.call(contract.scenes.exportJson, {
            body: { projectId, sceneIds: [scene.id] },
        })
        expect(exported).toEqual({
            scenes: [
                { name: 'scene', variations: [{ variables: [{ key: 'pose', value: 'sitting' }] }] },
            ],
        })
        expect(
            await t.call(contract.scenes.importJson, {
                body: { projectId: target.id, data: exported },
            }),
        ).toEqual({ imported: 1 })
        const list = await t.call(contract.scenes.list, { query: { projectId: target.id } })
        expect(poses(list[0]!)).toEqual(['sitting'])
    })

    it('replaces existing scenes in replace mode', async () => {
        const { projectId } = await createScene(t, { name: 'old' })
        await t.call(contract.scenes.importJson, {
            body: { projectId, mode: 'replace', data: [{ name: 'new', variations: [] }] },
        })
        const list = await t.call(contract.scenes.list, { query: { projectId } })
        expect(list.map((scene) => scene.name)).toEqual(['new'])
    })

    it('C3: a failure during replace keeps the existing scenes', async () => {
        const { projectId } = await createScene(t, { name: 'keep me' })
        expect(() =>
            t.ctx.db.transaction((tx) => {
                scenes.importScenes(
                    tx,
                    projectId,
                    [{ name: 'replacement', variations: [] }],
                    'replace',
                )
                throw new Error('forced failure')
            }),
        ).toThrow('forced failure')
        const list = await t.call(contract.scenes.list, { query: { projectId } })
        expect(list.map((scene) => scene.name)).toEqual(['keep me'])
    })
})

describe('preview', () => {
    it('renders variables into the prompt', async () => {
        const { scene } = await createScene(t, { poses: ['jumping'], prompt: '1girl, <<pose>>' })
        const preview = await t.call(contract.scenes.preview, { params: { id: scene.id } })
        expect(preview).toEqual({
            ok: true,
            prompts: [{ prompt: '1girl, jumping', negativePrompt: '', characterPrompts: [] }],
        })
    })

    it('reports template errors', async () => {
        const { scene } = await createScene(t, { prompt: '<<#if pose>>' })
        const preview = await t.call(contract.scenes.preview, { params: { id: scene.id } })
        expect(preview.ok).toBe(false)
    })
})

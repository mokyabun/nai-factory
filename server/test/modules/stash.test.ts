import { afterAll, describe, expect, it } from 'bun:test'

import { contract, DEFAULT_PROJECT_PARAMETERS } from '@nai-factory/shared'

import { createTestApp } from '../helpers/app'
import { createProject, createScene } from '../helpers/fixtures'

const t = await createTestApp()
afterAll(() => t.close())

describe('stash', () => {
    it('applies prompt and parameter stashes to a project', async () => {
        const project = await createProject(t)
        const prompt = await t.call(contract.stash.create, {
            body: {
                type: 'prompt',
                name: 'p',
                payload: {
                    prompt: 'stashed',
                    negativePrompt: 'bad',
                    variables: [],
                    characterPrompts: [],
                },
            },
        })
        const parameters = await t.call(contract.stash.create, {
            body: {
                type: 'parameters',
                name: 'q',
                payload: { ...DEFAULT_PROJECT_PARAMETERS, steps: 12 },
            },
        })
        await t.call(contract.stash.apply, {
            params: { id: prompt.id },
            body: { projectId: project.id },
        })
        await t.call(contract.stash.apply, {
            params: { id: parameters.id },
            body: { projectId: project.id },
        })
        const updated = await t.call(contract.projects.get, { params: { id: project.id } })
        expect(updated).toMatchObject({ prompt: 'stashed', negativePrompt: 'bad' })
        expect(updated.parameters.steps).toBe(12)
    })

    it('captures and re-applies scenes', async () => {
        const { projectId } = await createScene(t, { poses: ['a'] })
        const payload = await t.call(contract.stash.captureScenes, { body: { projectId } })
        const item = await t.call(contract.stash.create, {
            body: { type: 'scene', name: 's', payload },
        })
        const target = await createProject(t, 'target')
        expect(
            await t.call(contract.stash.apply, {
                params: { id: item.id },
                body: { projectId: target.id },
            }),
        ).toEqual({ applied: true, imported: 1 })
    })

    it('validates payload updates against the item type', async () => {
        const item = await t.call(contract.stash.create, {
            body: { type: 'scene', name: 's', payload: { scenes: [] } },
        })
        const response = await t.send(contract.stash.update, {
            params: { id: item.id },
            body: { payload: { prompt: 'wrong type' } },
        })
        expect(response.status).toBe(400)
    })
})

describe('SD Studio import', () => {
    it('imports scenes and preset prompts into a project', async () => {
        const project = await createProject(t)
        const result = await t.call(contract.sdStudio.import, {
            body: {
                projectId: project.id,
                options: { importPrompt: true, importParameters: true },
                data: {
                    name: 'pack',
                    scenes: {
                        s1: { name: 'scene one', slots: [[{ prompt: 'smile', enabled: true }]] },
                    },
                    selectedWorkflow: { workflowType: 'SDImageGen', presetName: 'default' },
                    presets: {
                        SDImageGen: [
                            {
                                type: 'SDImageGen',
                                name: 'default',
                                frontPrompt: 'front',
                                backPrompt: 'back',
                                steps: 99,
                            },
                        ],
                    },
                },
            },
        })
        expect(result).toEqual({ imported: 1 })
        const updated = await t.call(contract.projects.get, { params: { id: project.id } })
        expect(updated.prompt).toBe('front, <<prompt>>, back')
        expect(updated.parameters.steps).toBe(50)
    })

    it('rejects invalid files with 400', async () => {
        const project = await createProject(t)
        const response = await t.send(contract.sdStudio.import, {
            body: { projectId: project.id, data: { nope: true } },
        })
        expect(response.status).toBe(400)
    })
})

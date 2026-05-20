import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { eq } from 'drizzle-orm'
import { createDb } from '../../../src/db'

// ─── Mock setup ──────────────────────────────────────────────────────────────

mock.restore()
const testDb = createDb({ inMemory: true })

mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

const service =
    require('../../../src/domain/sd-studio/service') as typeof import('../../../src/domain/sd-studio/service')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedProject() {
    const [g] = await testDb.db.insert(testDb.groups).values({ name: 'g' }).returning()
    const [p] = await testDb.db
        .insert(testDb.projects)
        .values({ groupId: g!.id, name: 'p' })
        .returning()
    return { group: g!, project: p! }
}

async function getProject(id: number) {
    const [p] = await testDb.db.select().from(testDb.projects).where(eq(testDb.projects.id, id))
    return p!
}

const validSdStudioData = {
    name: 'Test Pack',
    scenes: {
        s1: {
            name: 'Scene 1',
            slots: [[{ prompt: 'cat', enabled: true }]],
        },
        s2: {
            name: 'Scene 2',
            slots: [[{ prompt: 'dog' }, { prompt: 'bird' }]],
        },
    },
}

const sdStudioDataWithPreset = {
    name: 'Preset Pack',
    selectedWorkflow: { workflowType: 'SDImageGen', presetName: 'default' },
    presets: {
        SDImageGen: [
            {
                type: 'SDImageGen',
                name: 'default',
                frontPrompt: '1girl',
                backPrompt: '{best quality}',
                uc: 'worst quality',
                steps: 28,
                promptGuidance: 5,
                sampling: 'k_euler_ancestral',
                cfgRescale: 0.2,
                noiseSchedule: 'karras',
                varietyPlus: true,
                characterPrompts: [
                    {
                        prompt: 'blue hair',
                        uc: 'bad anatomy',
                        enabled: true,
                        center: { x: 0.5, y: 0.5 },
                    },
                ],
            },
        ],
    },
    scenes: {
        s1: { name: 'Scene 1', slots: [[{ prompt: 'outside' }]] },
    },
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sd-studio domain service', () => {
    beforeEach(async () => {
        await testDb.db.delete(testDb.scenes).run()
        await testDb.db.delete(testDb.projects).run()
        await testDb.db.delete(testDb.groups).run()
    })

    describe('importToProject', () => {
        it('throws 404 when project does not exist', async () => {
            await expect(service.importToProject(9999, validSdStudioData)).rejects.toMatchObject({
                code: 404,
            })
        })

        it('throws on invalid SD Studio file data', async () => {
            const { project } = await seedProject()
            await expect(service.importToProject(project.id, { bad: 'data' })).rejects.toThrow(
                'Invalid SD Studio file',
            )
        })

        it('returns the count of imported scenes', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, validSdStudioData)

            expect(result.imported).toBe(2)
            expect(result.scenes).toHaveLength(2)
        })

        it('creates scene rows with correct names and variations', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, validSdStudioData)

            const names = result.scenes.map((s) => s.name)
            expect(names).toContain('Scene 1')
            expect(names).toContain('Scene 2')

            const scene1 = result.scenes.find((s) => s.name === 'Scene 1')!
            expect(scene1.variations).toEqual([{ prompt: 'cat' }])

            const scene2 = result.scenes.find((s) => s.name === 'Scene 2')!
            expect(scene2.variations).toHaveLength(2)
        })

        it('appends scenes after existing ones using fractional ordering', async () => {
            const { project } = await seedProject()
            // Seed an existing scene
            const [existing] = await testDb.db
                .insert(testDb.scenes)
                .values({ projectId: project.id, name: 'existing', displayOrder: 'a0' })
                .returning()

            const result = await service.importToProject(project.id, {
                name: 'pack',
                scenes: { s1: { name: 'New Scene', slots: [[{ prompt: 'x' }]] } },
            })

            // New scene must come after the existing one
            expect(result.scenes[0]!.displayOrder > existing!.displayOrder).toBe(true)
        })
    })

    describe('importToProject — import options', () => {
        it('does not modify project fields when no options are passed', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset)

            const p = await getProject(project.id)
            expect(p.prompt).toBe('')
            expect(p.negativePrompt).toBe('')
            expect(p.characterPrompts).toEqual([])
        })

        it('sets project.prompt to frontPrompt, [[prompt]], backPrompt when importPrompt=true', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset, {
                importPrompt: true,
            })

            const p = await getProject(project.id)
            expect(p.prompt).toBe('1girl, [[prompt]], {best quality}')
        })

        it('produces [[prompt]] only when front and back prompts are empty', async () => {
            const { project } = await seedProject()
            const dataNoSurround = {
                ...sdStudioDataWithPreset,
                presets: {
                    SDImageGen: [
                        {
                            ...sdStudioDataWithPreset.presets.SDImageGen[0]!,
                            frontPrompt: '',
                            backPrompt: '',
                        },
                    ],
                },
            }

            await service.importToProject(project.id, dataNoSurround, {
                importPrompt: true,
            })

            const p = await getProject(project.id)
            expect(p.prompt).toBe('[[prompt]]')
        })

        it('sets project.negativePrompt to preset.uc when importNegativePrompt=true', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset, {
                importNegativePrompt: true,
            })

            const p = await getProject(project.id)
            expect(p.negativePrompt).toBe('worst quality')
        })

        it('sets project.characterPrompts from preset when importCharacterPrompts=true', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset, {
                importCharacterPrompts: true,
            })

            const p = await getProject(project.id)
            expect(p.characterPrompts).toHaveLength(1)
            expect(p.characterPrompts[0]).toMatchObject({
                prompt: 'blue hair',
                uc: 'bad anatomy',
                enabled: true,
                center: { x: 0.5, y: 0.5 },
            })
        })

        it('defaults enabled/center when characterPrompts entries are missing those fields', async () => {
            const { project } = await seedProject()
            const dataMinimalChar = {
                ...sdStudioDataWithPreset,
                presets: {
                    SDImageGen: [
                        {
                            ...sdStudioDataWithPreset.presets.SDImageGen[0]!,
                            characterPrompts: [{ prompt: 'cat ears', uc: '' }],
                        },
                    ],
                },
            }

            await service.importToProject(project.id, dataMinimalChar, {
                importCharacterPrompts: true,
            })

            const p = await getProject(project.id)
            expect(p.characterPrompts[0]).toMatchObject({
                prompt: 'cat ears',
                uc: '',
                enabled: true,
                center: { x: 0.5, y: 0.5 },
            })
        })

        it('merges preset parameters into project when importParameters=true', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset, {
                importParameters: true,
            })

            const p = await getProject(project.id)
            const params = p.parameters
            expect(params.steps).toBe(28)
            expect(params.promptGuidance).toBe(5)
            expect(params.sampler).toBe('k_euler_ancestral')
            expect(params.promptGuidanceRescale).toBe(0.2)
            expect(params.noiseSchedule).toBe('karras')
            expect(params.varietyPlus).toBe(true)
        })

        it('keeps existing sampler when preset.sampling is not a valid NAI sampler', async () => {
            const { project } = await seedProject()
            const dataInvalidSampler = {
                ...sdStudioDataWithPreset,
                presets: {
                    SDImageGen: [
                        {
                            ...sdStudioDataWithPreset.presets.SDImageGen[0]!,
                            sampling: 'invalid_sampler',
                        },
                    ],
                },
            }

            await service.importToProject(project.id, dataInvalidSampler, {
                importParameters: true,
            })

            const p = await getProject(project.id)
            expect(p.parameters.sampler).not.toBe('invalid_sampler')
            // other params are still imported
            expect(p.parameters.steps).toBe(28)
        })

        it('applies all import options simultaneously', async () => {
            const { project } = await seedProject()

            await service.importToProject(project.id, sdStudioDataWithPreset, {
                importPrompt: true,
                importNegativePrompt: true,
                importCharacterPrompts: true,
                importParameters: true,
            })

            const p = await getProject(project.id)
            expect(p.prompt).toBe('1girl, [[prompt]], {best quality}')
            expect(p.negativePrompt).toBe('worst quality')
            expect(p.characterPrompts).toHaveLength(1)
            expect(p.parameters.steps).toBe(28)
        })

        it('skips project update when data has no preset (no selectedWorkflow)', async () => {
            const { project } = await seedProject()

            // validSdStudioData has no selectedWorkflow/presets
            await service.importToProject(project.id, validSdStudioData, {
                importPrompt: true,
            })

            const p = await getProject(project.id)
            expect(p.prompt).toBe('')
        })

        it('falls back to first preset when presetName does not match', async () => {
            const { project } = await seedProject()
            const dataWrongPresetName = {
                ...sdStudioDataWithPreset,
                selectedWorkflow: {
                    workflowType: 'SDImageGen',
                    presetName: 'nonexistent',
                },
            }

            await service.importToProject(project.id, dataWrongPresetName, {
                importPrompt: true,
            })

            // Falls back to first preset (which has frontPrompt: '1girl')
            const p = await getProject(project.id)
            expect(p.prompt).toBe('1girl, [[prompt]], {best quality}')
        })

        it('imports scenes by default when importScenes is not specified', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, sdStudioDataWithPreset)

            expect(result.imported).toBe(1)
            expect(result.scenes).toHaveLength(1)
        })

        it('skips scene insertion when importScenes=false', async () => {
            const { project } = await seedProject()

            const result = await service.importToProject(project.id, sdStudioDataWithPreset, {
                importScenes: false,
                importPrompt: true,
            })

            expect(result.imported).toBe(0)
            expect(result.scenes).toHaveLength(0)
            // project prompt should still be updated
            const p = await getProject(project.id)
            expect(p.prompt).toBe('1girl, [[prompt]], {best quality}')
        })
    })
})

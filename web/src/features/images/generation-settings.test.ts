import { DEFAULT_PROJECT_PARAMETERS } from '@nai-factory/shared'
import { describe, expect, it } from 'vitest'

import {
    applyGenerationParameters,
    generationSettingsPatch,
    playgroundUnsupportedNotice,
    readGenerationSettings,
    type SettingsSelection,
} from './generation-settings'

const metadata = {
    generator: 'nai-factory',
    prompt: '1girl, smile',
    negativePrompt: 'lowres',
    characterPrompts: [
        { prompt: 'a', uc: '', enabled: true, center: { x: 0.1, y: 0.7 } },
        { prompt: 'b', uc: '', enabled: false, center: { x: 0, y: 0 } },
        { prompt: 'no center' },
    ],
    parameters: {
        model: 'nai-diffusion-4-5-curated',
        width: 832,
        height: 1216,
        steps: 23,
        sampler: 'not-a-sampler',
        seed: 123456,
    },
    vibeTransfers: [{ strength: 0.6 }],
    characterReferences: [],
}

describe('generation settings', () => {
    it('reads valid parameters and skips invalid ones', () => {
        const settings = readGenerationSettings(metadata)

        expect(settings.prompt).toBe('1girl, smile')
        expect(settings.negativePrompt).toBe('lowres')
        expect(settings.seed).toBe(123456)
        expect(settings.parameters).toEqual({
            model: 'nai-diffusion-4-5-curated',
            width: 832,
            height: 1216,
            steps: 23,
        })
        expect(settings.references).toEqual({
            vibeTransfers: 1,
            characterReferences: 0,
        })
    })

    it('restores character prompts and moves off-grid centers to the middle', () => {
        expect(readGenerationSettings(metadata).characterPrompts).toEqual([
            { prompt: 'a', uc: '', enabled: true, center: { x: 0.1, y: 0.7 } },
            { prompt: 'b', uc: '', enabled: false, center: { x: 0.5, y: 0.5 } },
        ])
        expect(readGenerationSettings({}).characterPrompts).toBeNull()
    })

    it('treats an unrecorded or zero seed as unknown', () => {
        expect(readGenerationSettings({ parameters: { seed: 0 } }).seed).toBeNull()
        expect(readGenerationSettings({}).seed).toBeNull()
    })

    it('applies parameters with the image seed or a random seed', () => {
        const settings = readGenerationSettings(metadata)

        const fixed = applyGenerationParameters(DEFAULT_PROJECT_PARAMETERS, settings, 'image')
        expect(fixed).toMatchObject({ width: 832, steps: 23, seed: 123456 })
        expect(fixed.sampler).toBe(DEFAULT_PROJECT_PARAMETERS.sampler)

        const random = applyGenerationParameters(DEFAULT_PROJECT_PARAMETERS, settings, 'random')
        expect(random.seed).toBe(0)

        const kept = applyGenerationParameters(
            { ...DEFAULT_PROJECT_PARAMETERS, seed: 42 },
            settings,
            'keep',
        )
        expect(kept.seed).toBe(42)
    })

    it('lists inputs Playground cannot reproduce', () => {
        expect(playgroundUnsupportedNotice(readGenerationSettings(metadata))).toBe(
            '바이브 1개는 프로젝트 전용이라 Playground에 적용되지 않습니다',
        )
        expect(playgroundUnsupportedNotice(readGenerationSettings({}))).toBeNull()
    })

    describe('generationSettingsPatch', () => {
        const current = {
            prompt: 'masterpiece,',
            negativePrompt: '',
            characterPrompts: [],
            parameters: { ...DEFAULT_PROJECT_PARAMETERS, seed: 42 },
        }
        const nothing: SettingsSelection = {
            prompt: false,
            negativePrompt: false,
            characterPrompts: false,
            parameters: false,
            seed: 'keep',
            promptMode: 'replace',
        }
        const settings = readGenerationSettings(metadata)

        it('changes only the selected fields', () => {
            expect(generationSettingsPatch(current, settings, nothing)).toEqual({})
            expect(
                generationSettingsPatch(current, settings, { ...nothing, seed: 'image' }),
            ).toEqual({ parameters: { ...DEFAULT_PROJECT_PARAMETERS, seed: 123456 } })
        })

        it('appends prompts after the current ones', () => {
            const patch = generationSettingsPatch(current, settings, {
                ...nothing,
                prompt: true,
                negativePrompt: true,
                promptMode: 'append',
            })
            expect(patch).toEqual({ prompt: 'masterpiece, 1girl, smile', negativePrompt: 'lowres' })
        })

        it('replaces characters and keeps the current seed with parameters', () => {
            const patch = generationSettingsPatch(current, settings, {
                ...nothing,
                characterPrompts: true,
                parameters: true,
            })
            expect(patch.characterPrompts).toHaveLength(2)
            expect(patch.parameters).toMatchObject({ width: 832, steps: 23, seed: 42 })
        })
    })
})

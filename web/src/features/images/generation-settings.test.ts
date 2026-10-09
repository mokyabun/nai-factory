import { DEFAULT_PROJECT_PARAMETERS } from '@nai-factory/shared'
import { describe, expect, it } from 'vitest'

import {
    applyGenerationParameters,
    playgroundUnsupportedNotice,
    readGenerationSettings,
} from './generation-settings'

const metadata = {
    generator: 'nai-factory',
    prompt: '1girl, smile',
    negativePrompt: 'lowres',
    characterPrompts: [
        { prompt: 'a', uc: '', enabled: true },
        { prompt: 'b', uc: '', enabled: false },
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
            characterPrompts: 1,
            vibeTransfers: 1,
            characterReferences: 0,
        })
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
            '캐릭터 프롬프트 1개, 바이브 1개는 Playground에 적용되지 않습니다',
        )
        expect(playgroundUnsupportedNotice(readGenerationSettings({}))).toBeNull()
    })
})

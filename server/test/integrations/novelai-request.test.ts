import { describe, expect, it } from 'bun:test'

import {
    type CharacterPrompt,
    characterGridCell,
    DEFAULT_CHARACTER_CENTER,
    DEFAULT_PROJECT_PARAMETERS,
} from '@nai-factory/shared'

import { buildGenerateRequest, type GenerationInput } from '@/integrations/novelai/request'

function character(prompt: string, center: CharacterPrompt['center']): CharacterPrompt {
    return { enabled: true, center, prompt, uc: '' }
}

function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
    return {
        prompt: 'scene',
        negativePrompt: '',
        characterPrompts: [],
        parameters: { ...DEFAULT_PROJECT_PARAMETERS, seed: 1, useCharacterPositions: true },
        vibes: [],
        characterReferences: [],
        ...overrides,
    }
}

describe('buildGenerateRequest', () => {
    it('sends each character at its chosen center', () => {
        const request = buildGenerateRequest(
            input({
                characterPrompts: [
                    character('left', { x: 0.1, y: 0.5 }),
                    character('right', { x: 0.9, y: 0.5 }),
                ],
            }),
        )

        const prompt = request.parameters.v4_prompt
        expect(prompt.use_coords).toBe(true)
        expect(prompt.caption.char_captions.map((caption) => caption.centers)).toEqual([
            [{ x: 0.1, y: 0.5 }],
            [{ x: 0.9, y: 0.5 }],
        ])
        expect(
            request.parameters.v4_negative_prompt.caption.char_captions.map(
                (caption) => caption.centers,
            ),
        ).toEqual([[{ x: 0.1, y: 0.5 }], [{ x: 0.9, y: 0.5 }]])
    })

    it('keeps positions for V5 models', () => {
        const request = buildGenerateRequest(
            input({
                characterPrompts: [character('a', { x: 0.3, y: 0.7 })],
                parameters: {
                    ...DEFAULT_PROJECT_PARAMETERS,
                    model: 'nai-diffusion-5-full',
                    seed: 1,
                    useCharacterPositions: true,
                },
            }),
        )
        expect(request.parameters.use_coords).toBe(true)
        expect(request.parameters.v4_prompt.caption.char_captions[0]?.centers).toEqual([
            { x: 0.3, y: 0.7 },
        ])
    })
})

describe('character grid', () => {
    it('defaults new characters to the center cell', () => {
        expect(DEFAULT_CHARACTER_CENTER).toEqual({ x: 0.5, y: 0.5 })
        expect(characterGridCell(DEFAULT_CHARACTER_CENTER)).toBe('C3')
    })

    it('names cells by column and row', () => {
        expect(characterGridCell({ x: 0.1, y: 0.1 })).toBe('A1')
        expect(characterGridCell({ x: 0.9, y: 0.7 })).toBe('E4')
        expect(characterGridCell({ x: 0, y: 1 })).toBe('A5')
    })
})

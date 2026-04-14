import { describe, expect, it } from 'bun:test'
import { parseSdStudioFile } from './sd-studio-import'

describe('parseSdStudioFile', () => {
    it('throws on missing name', () => {
        expect(() => parseSdStudioFile({ scenes: {} })).toThrow('Invalid SD Studio file')
    })

    it('throws on missing scenes', () => {
        expect(() => parseSdStudioFile({ name: 'pack' })).toThrow('Invalid SD Studio file')
    })

    it('throws when scenes is not an object', () => {
        expect(() => parseSdStudioFile({ name: 'pack', scenes: 'bad' })).toThrow(
            'Invalid SD Studio file',
        )
    })

    it('returns the file name in the result', () => {
        const result = parseSdStudioFile({ name: 'my pack', scenes: {} })
        expect(result.name).toBe('my pack')
    })

    it('returns empty scenes array for empty scenes object', () => {
        const result = parseSdStudioFile({ name: 'pack', scenes: {} })
        expect(result.scenes).toEqual([])
    })

    it('uses the scene key as name when scene.name is falsy', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: { myKey: { name: '', slots: [] } },
        })
        expect(result.scenes[0]!.name).toBe('myKey')
    })

    it('returns a single empty-prompt variation when all slots are empty', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: { s1: { name: 'S1', slots: [] } },
        })
        expect(result.scenes[0]!.variations).toEqual([{ prompt: '' }])
    })

    it('returns one variation per enabled alternative in a single slot group', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: {
                    name: 'S1',
                    slots: [[{ prompt: 'cat', enabled: true }, { prompt: 'dog', enabled: true }]],
                },
            },
        })
        expect(result.scenes[0]!.variations).toHaveLength(2)
        expect(result.scenes[0]!.variations[0]).toEqual({ prompt: 'cat' })
        expect(result.scenes[0]!.variations[1]).toEqual({ prompt: 'dog' })
    })

    it('generates cartesian product for multiple slot groups', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: {
                    name: 'S1',
                    slots: [
                        [{ prompt: 'cat' }, { prompt: 'dog' }],
                        [{ prompt: 'red' }, { prompt: 'blue' }],
                    ],
                },
            },
        })
        const prompts = result.scenes[0]!.variations.map((v) => v.prompt)
        expect(prompts).toHaveLength(4)
        expect(prompts).toContain('cat, red')
        expect(prompts).toContain('cat, blue')
        expect(prompts).toContain('dog, red')
        expect(prompts).toContain('dog, blue')
    })

    it('filters out disabled alternatives', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: {
                    name: 'S1',
                    slots: [[{ prompt: 'cat', enabled: true }, { prompt: 'dog', enabled: false }]],
                },
            },
        })
        expect(result.scenes[0]!.variations).toHaveLength(1)
        expect(result.scenes[0]!.variations[0]).toEqual({ prompt: 'cat' })
    })

    it('treats alternatives without enabled field as enabled', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: { name: 'S1', slots: [[{ prompt: 'no-flag' }]] },
            },
        })
        expect(result.scenes[0]!.variations).toHaveLength(1)
        expect(result.scenes[0]!.variations[0]).toEqual({ prompt: 'no-flag' })
    })

    it('returns empty-prompt variation when all alternatives are disabled', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: { name: 'S1', slots: [[{ prompt: 'cat', enabled: false }]] },
            },
        })
        expect(result.scenes[0]!.variations).toEqual([{ prompt: '' }])
    })

    it('resolves library references in prompts', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: { s1: { name: 'S1', slots: [[{ prompt: '<animals.cat>' }]] } },
            library: {
                animals: { name: 'Animals', pieces: [{ name: 'cat', prompt: 'fluffy cat' }] },
            },
        })
        expect(result.scenes[0]!.variations[0]).toEqual({ prompt: 'fluffy cat' })
    })

    it('replaces unknown library refs with empty string', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: { s1: { name: 'S1', slots: [[{ prompt: '<unknown.piece>' }]] } },
        })
        // empty ref → empty slot → cleanPrompt trims
        expect(result.scenes[0]!.variations[0]!.prompt).toBe('')
    })

    it('cleans consecutive commas in combined prompts', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                s1: {
                    name: 'S1',
                    // second group has empty prompt → would produce "cat, , dog"
                    slots: [[{ prompt: 'cat' }], [{ prompt: '' }], [{ prompt: 'dog' }]],
                },
            },
        })
        const prompt = result.scenes[0]!.variations[0]!.prompt
        expect(prompt).not.toMatch(/,\s*,/)
        expect(prompt).toBe('cat, dog')
    })

    it('parses multiple scenes independently', () => {
        const result = parseSdStudioFile({
            name: 'pack',
            scenes: {
                a: { name: 'A', slots: [[{ prompt: 'alpha' }]] },
                b: { name: 'B', slots: [[{ prompt: 'beta' }]] },
            },
        })
        expect(result.scenes).toHaveLength(2)
    })
})

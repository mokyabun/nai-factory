import { describe, expect, it } from 'bun:test'
import type { Prompt, PromptVariable } from '@/types'
import { compilePrompts, compileVariables } from './prompt'

const basePrompt: Prompt = {
    prompt: 'a {{subject}} in {{setting}}',
    negativePrompt: 'bad {{subject}}',
    characterPrompts: [],
}

const singleVariable: PromptVariable = { subject: 'cat', setting: 'forest' }

describe('compilePrompts', () => {
    it('returns one compiled Prompt per variable entry', () => {
        const results = compilePrompts(basePrompt, [singleVariable])
        expect(results).toHaveLength(1)
    })

    it('interpolates positive and negative prompts', () => {
        const result = compilePrompts(basePrompt, [singleVariable])[0]!
        expect(result.prompt).toBe('a cat in forest')
        expect(result.negativePrompt).toBe('bad cat')
    })

    it('produces multiple results for multiple variable entries', () => {
        const variables: PromptVariable[] = [
            { subject: 'cat', setting: 'forest' },
            { subject: 'dog', setting: 'city' },
        ]
        const results = compilePrompts(basePrompt, variables)
        expect(results).toHaveLength(2)
        expect(results[0]!.prompt).toBe('a cat in forest')
        expect(results[1]!.prompt).toBe('a dog in city')
    })

    it('returns an empty array when given no variable entries', () => {
        expect(compilePrompts(basePrompt, [])).toEqual([])
    })

    it('compiles character prompts with the same variables', () => {
        const source: Prompt = {
            prompt: '{{subject}}',
            negativePrompt: '',
            characterPrompts: [{ enabled: true, prompt: 'char {{subject}}', uc: 'no {{subject}}' }],
        }
        const result = compilePrompts(source, [{ subject: 'wizard' }])[0]!
        expect(result.characterPrompts).toHaveLength(1)
        expect(result.characterPrompts[0]!.prompt).toBe('char wizard')
        expect(result.characterPrompts[0]!.uc).toBe('no wizard')
    })

    it('preserves the enabled flag on character prompts', () => {
        const source: Prompt = {
            prompt: '',
            negativePrompt: '',
            characterPrompts: [{ enabled: false, prompt: '', uc: '' }],
        }
        const result = compilePrompts(source, [{}])[0]!
        expect(result.characterPrompts[0]!.enabled).toBe(false)
    })

    it('treats missing variables as empty strings', () => {
        const source: Prompt = {
            prompt: '{{unknown}}',
            negativePrompt: '',
            characterPrompts: [],
        }
        const result = compilePrompts(source, [{}])[0]!
        expect(result.prompt).toBe('')
    })
})

describe('compileVariables', () => {
    it('returns one merged entry per variation', () => {
        const result = compileVariables({ a: '1' }, { b: '2' }, [{ c: '3' }])
        expect(result).toHaveLength(1)
    })

    it('merges global, project, and variation variables', () => {
        const global: PromptVariable = { a: 'global-a', shared: 'global' }
        const project: PromptVariable = { b: 'project-b', shared: 'project' }
        const variation: PromptVariable = { c: 'variation-c', shared: 'variation' }
        const result = compileVariables(global, project, [variation])[0]!
        expect(result.a).toBe('global-a')
        expect(result.b).toBe('project-b')
        expect(result.c).toBe('variation-c')
    })

    it('project variables override global variables', () => {
        const result = compileVariables({ key: 'global' }, { key: 'project' }, [{}])[0]!
        expect(result.key).toBe('project')
    })

    it('variation variables override project and global variables', () => {
        const result = compileVariables({ key: 'global' }, { key: 'project' }, [
            { key: 'variation' },
        ])[0]!
        expect(result.key).toBe('variation')
    })

    it('returns an empty array when there are no variations', () => {
        expect(compileVariables({ a: '1' }, { b: '2' }, [])).toEqual([])
    })

    it('produces one entry per variation when multiple are provided', () => {
        const vars = [{ n: '1' }, { n: '2' }, { n: '3' }]
        const result = compileVariables({}, {}, vars)
        expect(result).toHaveLength(3)
        expect(result.map((v) => v.n)).toEqual(['1', '2', '3'])
    })

    it('does not mutate the original variable objects', () => {
        const global: PromptVariable = { key: 'global' }
        const project: PromptVariable = { key: 'project' }
        const variation: PromptVariable = { key: 'variation' }
        compileVariables(global, project, [variation])
        expect(global.key).toBe('global')
        expect(project.key).toBe('project')
        expect(variation.key).toBe('variation')
    })
})

import Handlebars from 'handlebars'
import type { CharacterPrompt, Prompt, PromptVariable } from '@/types'

export function compilePrompts(source: Prompt, variables: PromptVariable[]): Prompt[] {
    const results: Prompt[] = []
    for (const vars of variables) {
        const render = (template: string): string => Handlebars.compile(template)(vars)

        const positive = render(source.prompt)
        const negative = render(source.negativePrompt)

        const characterPrompts: CharacterPrompt[] = source.characterPrompts.map((char) => ({
            enabled: char.enabled,
            prompt: render(char.prompt),
            negativePrompt: render(char.negativePrompt),
        }))

        results.push({
            prompt: positive,
            negativePrompt: negative,
            characterPrompts,
        })
    }

    return results
}

export function compileVariables(
    globalVars: PromptVariable,
    projectVars: PromptVariable,
    variationVars: PromptVariable[],
): PromptVariable[] {
    return variationVars.map((variation) => ({
        ...globalVars,
        ...projectVars,
        ...variation,
    }))
}

import Handlebars from 'handlebars'
import type { CompiledCharacterPrompt, Prompt, PromptVariable } from '@/types'

/**
 * Compile prompts by applying variable sets via Handlebars templates.
 * Returns one Prompt per variable set.
 */
export function compilePrompts(source: Prompt, variables: PromptVariable[]): Prompt[] {
    const results: Prompt[] = []

    for (const vars of variables) {
        const render = (template: string): string => Handlebars.compile(template)(vars)

        const characterPrompts: CompiledCharacterPrompt[] = source.characterPrompts.map((c) => ({
            enabled: c.enabled,
            prompt: render(c.prompt),
            uc: render(c.uc),
        }))

        results.push({
            prompt: render(source.prompt),
            negativePrompt: render(source.negativePrompt),
            characterPrompts,
        })
    }

    return results
}

/**
 * Merge variable layers: global < project < variation.
 * Returns one merged PromptVariable per variation entry.
 */
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

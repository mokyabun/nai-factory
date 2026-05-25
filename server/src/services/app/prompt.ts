import type { CharacterPrompt, Prompt, PromptVariable } from '@nai-factory/types'

// regex to match [[variableName]] in prompt templates
const TEMPLATE_VAR_RE = /\[\[([a-zA-Z_$][a-zA-Z0-9_$]*)\]\]/g

function render(template: string, vars: PromptVariable): string {
    return template.replace(TEMPLATE_VAR_RE, (_, key) => vars[key] ?? '')
}

function renderMultiple(template: string, vars: PromptVariable, count = 2): string {
    let result: string = template

    for (let i = 0; i < count; i++) {
        result = render(result, vars)
    }

    return result
}

export function compilePrompts(source: Prompt, variables: PromptVariable[]): Prompt[] {
    const results: Prompt[] = []
    for (const vars of variables) {
        const characterPrompts: CharacterPrompt[] = source.characterPrompts.map((char) => ({
            enabled: char.enabled,
            prompt: renderMultiple(char.prompt, vars),
            uc: renderMultiple(char.uc, vars),
            center: char.center,
        }))

        results.push({
            prompt: renderMultiple(source.prompt, vars),
            negativePrompt: renderMultiple(source.negativePrompt, vars),
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

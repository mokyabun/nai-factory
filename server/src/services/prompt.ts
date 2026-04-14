import type { CharacterPrompt, Prompt, PromptVariable } from '@/types'

// regex to match [[variableName]] in prompt templates
const TEMPLATE_VAR_RE = /\[\[([a-zA-Z_$][a-zA-Z0-9_$]*)\]\]/g

function render(template: string, vars: PromptVariable): string {
    return template.replace(TEMPLATE_VAR_RE, (_, key) => vars[key] ?? '')
}

export function compilePrompts(source: Prompt, variables: PromptVariable[]): Prompt[] {
    const results: Prompt[] = []
    for (const vars of variables) {
        const characterPrompts: CharacterPrompt[] = source.characterPrompts.map((char) => ({
            enabled: char.enabled,
            prompt: render(char.prompt, vars),
            uc: render(char.uc, vars),
            center: char.center,
        }))

        results.push({
            prompt: render(source.prompt, vars),
            negativePrompt: render(source.negativePrompt, vars),
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

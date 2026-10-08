import type { CharacterPrompt, Prompt, PromptVariable } from '@nai-factory/shared'
import Handlebars from 'handlebars'

const HANDLEBARS_LITERAL_RE = /{{{[\s\S]*?}}}|{{[\s\S]*?}}/g
const NAI_TEMPLATE_RE = /<<([\s\S]*?)>>/g
const RENDER_PASSES = 3

type PromptVariableContext = Record<string, string>

export class PromptRenderError extends Error {
    readonly category = 'template'

    constructor(
        message: string,
        override readonly cause?: unknown,
    ) {
        super(message)
        this.name = 'PromptRenderError'
    }
}

function toContext(variables: PromptVariable): PromptVariableContext {
    const context: PromptVariableContext = {}
    for (const variable of variables) {
        context[variable.key] = variable.value
    }
    return context
}

function prepareTemplate(template: string) {
    const literals: string[] = []
    const protectedTemplate = template.replace(HANDLEBARS_LITERAL_RE, (literal) => {
        const token = `@@NAI_FACTORY_LITERAL_${literals.length}@@`
        literals.push(literal)
        return token
    })

    return {
        template: protectedTemplate.replace(NAI_TEMPLATE_RE, (_, content: string) => {
            return `{{${content}}}`
        }),
        literals,
    }
}

function restoreLiterals(rendered: string, literals: string[]) {
    return literals.reduce(
        (result, literal, index) => result.replaceAll(`@@NAI_FACTORY_LITERAL_${index}@@`, literal),
        rendered,
    )
}

function render(template: string, vars: PromptVariableContext): string {
    const prepared = prepareTemplate(template)

    try {
        const compiled = Handlebars.compile(prepared.template, { noEscape: true })
        return restoreLiterals(compiled(vars), prepared.literals)
    } catch (error) {
        throw new PromptRenderError(
            error instanceof Error ? error.message : 'Failed to render prompt template',
            error,
        )
    }
}

function renderMultiple(
    template: string,
    vars: PromptVariableContext,
    count = RENDER_PASSES,
): string {
    let result = template

    for (let i = 0; i < count; i++) {
        result = render(result, vars)
    }

    return result
}

export function compilePrompts(source: Prompt, variables: PromptVariableContext[]): Prompt[] {
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
): PromptVariableContext[] {
    return variationVars.map((variation) => ({
        ...toContext(globalVars),
        ...toContext(projectVars),
        ...toContext(variation),
    }))
}

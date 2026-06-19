import type { PromptVariable } from '@nai-factory/shared'

export function normalizeVariableDraft(variables: PromptVariable): PromptVariable {
    return variables.map((variable) => ({
        key: variable.key.trim(),
        value: variable.value,
    }))
}

export function variableValidationMessage(variables: PromptVariable): string | null {
    const seen = new Set<string>()
    for (const variable of variables) {
        const key = variable.key.trim()
        if (!key) return 'Variable keys cannot be empty.'
        if (seen.has(key)) return `Duplicate variable key: ${key}`
        seen.add(key)
    }

    return null
}

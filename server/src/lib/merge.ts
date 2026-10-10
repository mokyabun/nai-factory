function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Arrays replace instead of merging; `undefined` keeps the base value. */
export function deepMerge<T>(base: T, patch: unknown): T {
    if (!isPlainObject(base) || !isPlainObject(patch)) {
        return (patch === undefined ? base : patch) as T
    }

    const result: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue
        result[key] = deepMerge(result[key], value)
    }
    return result as T
}

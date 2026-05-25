export function withUpdatedAt<T extends object>(data: T) {
    return { ...data, updatedAt: new Date().toISOString() }
}

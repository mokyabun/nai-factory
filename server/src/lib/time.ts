export function toIso(date: Date): string
export function toIso(date: Date | null): string | null
export function toIso(date: Date | null) {
    return date === null ? null : date.toISOString()
}

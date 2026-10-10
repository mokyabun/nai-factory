export function toIso(date: Date): string
export function toIso(date: Date | null): string | null
export function toIso(date: Date | null) {
    return date === null ? null : date.toISOString()
}

/** UTC time to the second without `:`, which Windows file names cannot contain. */
export function toFileStamp(date: Date) {
    return date
        .toISOString()
        .replace(/\.\d+Z$/, 'Z')
        .replaceAll(':', '-')
}

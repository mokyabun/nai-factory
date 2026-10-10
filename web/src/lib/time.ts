const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
})

/** Server timestamps are ISO-8601 UTC strings; `Date` handles the conversion to local time. */
export function parseIso(value: string) {
    return new Date(value)
}

export function formatDateTime(value: string | Date) {
    return dateTimeFormat.format(typeof value === 'string' ? parseIso(value) : value)
}

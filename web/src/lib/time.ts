const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
})
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** Server timestamps are ISO-8601 UTC strings; `Date` handles the conversion to local time. */
export function parseIso(value: string) {
    return new Date(value)
}

export function formatDateTime(value: string | Date) {
    return dateTimeFormat.format(typeof value === 'string' ? parseIso(value) : value)
}

export function formatTime(value: string | Date) {
    return timeFormat.format(typeof value === 'string' ? parseIso(value) : value)
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
]

export function formatRelative(value: string | Date, now = Date.now()) {
    const date = typeof value === 'string' ? parseIso(value) : value
    const seconds = Math.round((date.getTime() - now) / 1000)
    for (const [unit, size] of RELATIVE_UNITS) {
        if (Math.abs(seconds) >= size || unit === 'second') {
            return relativeFormat.format(Math.round(seconds / size), unit)
        }
    }
    return relativeFormat.format(0, 'second')
}

import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function debounce<TArgs extends unknown[]>(
    fn: (...args: TArgs) => unknown,
    delay: number,
): ((...args: TArgs) => void) & { flush: () => void; cancel: () => void } {
    let timer: ReturnType<typeof setTimeout> | null = null
    let pendingArgs: TArgs | null = null

    function debounced(...args: TArgs) {
        pendingArgs = args
        if (timer !== null) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            const args = pendingArgs
            pendingArgs = null
            if (args) fn(...args)
        }, delay)
    }

    debounced.flush = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
            const args = pendingArgs
            pendingArgs = null
            if (args) fn(...args)
        }
    }

    debounced.cancel = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
            pendingArgs = null
        }
    }

    return debounced
}

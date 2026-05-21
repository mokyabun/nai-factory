import { clsx, type ClassValue } from 'clsx'
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

    function run() {
        const args = pendingArgs
        timer = null
        pendingArgs = null
        if (args) fn(...args)
    }

    function debounced(...args: TArgs) {
        pendingArgs = args
        if (timer) clearTimeout(timer)
        timer = setTimeout(run, delay)
    }

    debounced.flush = () => {
        if (!timer) return
        clearTimeout(timer)
        run()
    }

    debounced.cancel = () => {
        if (timer) clearTimeout(timer)
        timer = null
        pendingArgs = null
    }

    return debounced
}

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }

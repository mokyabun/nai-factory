import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const VARIANT_CLASSES = {
    /** Fills the remaining space of a page. */
    page: 'flex flex-1 items-center justify-center text-center text-sm',
    /** Fills the remaining space of a sidebar panel. */
    panel: 'flex flex-1 items-center justify-center p-4 text-center text-xs',
    /** Stands in for an empty or loading list. */
    inline: 'py-4 text-center text-xs',
}

/** Loading, empty and not-found messages. */
export function StatusMessage({
    variant = 'page',
    className,
    children,
}: {
    variant?: keyof typeof VARIANT_CLASSES
    className?: string
    children: ReactNode
}) {
    return (
        <div className={cn('text-muted-foreground', VARIANT_CLASSES[variant], className)}>
            {children}
        </div>
    )
}

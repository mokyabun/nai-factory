import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const VARIANT_CLASSES = {
    page: 'flex flex-1 items-center justify-center text-center text-sm',
    panel: 'flex flex-1 items-center justify-center p-4 text-center text-xs',
    inline: 'py-4 text-center text-xs',
}

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

import * as React from 'react'
import { cn } from '@/lib/utils'

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(
                'relative grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border bg-background p-3 text-xs text-foreground',
                className,
            )}
            {...props}
        />
    )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-title"
            className={cn('col-start-2 font-medium leading-none', className)}
            {...props}
        />
    )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-description"
            className={cn('col-start-2 text-muted-foreground', className)}
            {...props}
        />
    )
}

export { Alert, AlertDescription, AlertTitle }

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function ToolbarIconButton({
    label,
    variant = 'outline',
    disabled,
    onClick,
    children,
}: {
    label: string
    variant?: 'outline' | 'ghost' | 'destructive'
    disabled?: boolean
    onClick: () => void
    children: ReactNode
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        variant={variant}
                        size="icon-sm"
                        aria-label={label}
                        onClick={onClick}
                        disabled={disabled}
                    />
                }
            >
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    )
}

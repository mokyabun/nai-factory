import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

export function SettingField({
    label,
    htmlFor,
    children,
}: {
    label: string
    htmlFor?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
        </div>
    )
}

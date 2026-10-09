import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface OptionRowProps {
    id: string
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: () => void
}

export function OptionRow({ id, label, description, checked, disabled, onChange }: OptionRowProps) {
    return (
        <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-40')}>
            <Label htmlFor={id} className="flex cursor-pointer gap-0.5">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{description}</span>
            </Label>
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                className="mt-0.5 shrink-0"
            />
        </div>
    )
}

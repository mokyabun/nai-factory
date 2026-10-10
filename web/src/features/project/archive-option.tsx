import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface ArchiveOptionProps {
    id: string
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}

export function ArchiveOption({
    id,
    label,
    description,
    checked,
    disabled,
    onChange,
}: ArchiveOptionProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 border transition-colors',
                checked && !disabled ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/50',
                disabled && 'opacity-50',
            )}
        >
            <Label
                htmlFor={id}
                className={cn(
                    'min-w-0 flex-1 flex-col items-start gap-1 py-2.5 pl-3',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                )}
            >
                <span className="text-sm font-medium">{label}</span>
                <span className="w-full truncate text-xs font-normal text-muted-foreground">
                    {description}
                </span>
            </Label>
            <Switch
                id={id}
                size="sm"
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                className="mr-3"
            />
        </div>
    )
}

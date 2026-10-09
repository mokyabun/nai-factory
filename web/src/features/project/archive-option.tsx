import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

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
        <div className="flex items-start justify-between gap-4">
            <Label
                htmlFor={id}
                className="flex min-w-0 cursor-pointer flex-col gap-0.5 data-disabled:cursor-not-allowed data-disabled:opacity-50"
                data-disabled={disabled ? '' : undefined}
            >
                <span className="text-sm">{label}</span>
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

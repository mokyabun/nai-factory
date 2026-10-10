import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export function formatRatio(value: number) {
    return value.toFixed(2)
}

export function LabeledSlider({
    label,
    value,
    min,
    max,
    step,
    format = String,
    compact = false,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    format?: (value: number) => string
    /** Smaller label, for sliders nested inside a list item. */
    compact?: boolean
    onChange: (value: number) => void
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label className={cn(compact && 'text-xs')}>{label}</Label>
                <span className="text-xs text-muted-foreground">{format(value)}</span>
            </div>
            <Slider
                value={[value]}
                min={min}
                max={max}
                step={step}
                onValueChange={(next) =>
                    onChange(typeof next === 'number' ? next : (next[0] ?? value))
                }
            />
        </div>
    )
}

export function NumberField({
    id,
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    id: string
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    onChange: (value: number) => void
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}

export function SelectField<T extends string>({
    label,
    value,
    options,
    disabled,
    compact = false,
    onChange,
}: {
    label: string
    value: T
    options: readonly { value: T; label: string }[]
    disabled?: boolean
    compact?: boolean
    onChange: (value: T) => void
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className={cn(compact && 'text-xs')}>{label}</Label>
            <Select
                value={value}
                // Lets the trigger show the option's label instead of its raw value.
                items={options}
                disabled={disabled}
                onValueChange={(next) => next !== null && onChange(next as T)}
            >
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

export function ToggleRow({
    label,
    checked,
    disabled,
    compact = false,
    onChange,
}: {
    label: string
    checked: boolean
    disabled?: boolean
    compact?: boolean
    onChange: (checked: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label className={cn(compact && 'text-xs')}>{label}</Label>
            <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
        </div>
    )
}

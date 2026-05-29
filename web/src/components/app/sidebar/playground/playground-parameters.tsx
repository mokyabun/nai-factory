import type { Parameters } from '@nai-factory/shared'
import {
    NOVEL_AI_MODEL_OPTIONS,
    NOVEL_AI_NOISE_SCHEDULE_OPTIONS,
    NOVEL_AI_SAMPLER_OPTIONS,
} from '@nai-factory/shared'
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

interface PlaygroundParametersProps {
    parameters: Parameters
    onChange: <K extends keyof Parameters>(key: K, value: Parameters[K]) => void
}

export function PlaygroundParameters({ parameters, onChange }: PlaygroundParametersProps) {
    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <Label>모델</Label>
                <Select
                    value={parameters.model}
                    onValueChange={(value) => onChange('model', value as Parameters['model'])}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {NOVEL_AI_MODEL_OPTIONS.map((model) => (
                            <SelectItem key={model.value} value={model.value}>
                                {model.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <NumberField
                    id="sidebar-playground-width"
                    label="너비"
                    value={parameters.width}
                    min={64}
                    max={2048}
                    step={64}
                    onChange={(value) => onChange('width', value)}
                />
                <NumberField
                    id="sidebar-playground-height"
                    label="높이"
                    value={parameters.height}
                    min={64}
                    max={2048}
                    step={64}
                    onChange={(value) => onChange('height', value)}
                />
            </div>

            <ParameterSlider
                label="스텝"
                value={parameters.steps}
                min={1}
                max={50}
                step={1}
                onChange={(value) => onChange('steps', sliderValue(value, parameters.steps))}
            />
            <ParameterSlider
                label="CFG Scale"
                value={parameters.promptGuidance}
                min={1}
                max={10}
                step={0.1}
                onChange={(value) =>
                    onChange('promptGuidance', sliderValue(value, parameters.promptGuidance))
                }
            />
            <ParameterSlider
                label="CFG Rescale"
                value={parameters.promptGuidanceRescale}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                    onChange(
                        'promptGuidanceRescale',
                        sliderValue(value, parameters.promptGuidanceRescale),
                    )
                }
            />

            <NumberField
                id="sidebar-playground-seed"
                label="시드 (0 = 랜덤)"
                value={parameters.seed}
                min={0}
                onChange={(value) => onChange('seed', value)}
            />

            <div className="flex flex-col gap-1.5">
                <Label>샘플러</Label>
                <Select
                    value={parameters.sampler}
                    onValueChange={(value) => onChange('sampler', value as Parameters['sampler'])}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {NOVEL_AI_SAMPLER_OPTIONS.map((sampler) => (
                            <SelectItem key={sampler.value} value={sampler.value}>
                                {sampler.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>노이즈 스케줄</Label>
                <Select
                    value={parameters.noiseSchedule}
                    onValueChange={(value) =>
                        onChange('noiseSchedule', value as Parameters['noiseSchedule'])
                    }
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {NOVEL_AI_NOISE_SCHEDULE_OPTIONS.map((schedule) => (
                            <SelectItem key={schedule.value} value={schedule.value}>
                                {schedule.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-col gap-3 pb-4">
                <ToggleRow
                    label="Quality Toggle"
                    checked={parameters.qualityToggle}
                    onChange={(checked) => onChange('qualityToggle', checked)}
                />
                <ToggleRow
                    label="Variety+"
                    checked={parameters.varietyPlus}
                    onChange={(checked) => onChange('varietyPlus', checked)}
                />
            </div>
        </>
    )
}

function NumberField({
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

function ParameterSlider({
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (value: number | readonly number[]) => void
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <span className="text-xs text-muted-foreground">{value}</span>
            </div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={onChange} />
        </div>
    )
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label>{label}</Label>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}

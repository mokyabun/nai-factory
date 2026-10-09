import {
    isNovelAIV5Model,
    NOVEL_AI_MODEL_OPTIONS,
    NOVEL_AI_NOISE_SCHEDULE_OPTIONS,
    NOVEL_AI_SAMPLER_OPTIONS,
    type Parameters as ProjectParams,
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

interface ParameterEditorProps {
    parameters: ProjectParams
    onChange: <K extends keyof ProjectParams>(key: K, value: ProjectParams[K]) => void
}

export function ParameterEditor({ parameters: params, onChange: set }: ParameterEditorProps) {
    const isV5 = isNovelAIV5Model(params.model)

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    return (
        <div className="flex flex-col gap-5 pb-4">
            <div className="flex flex-col gap-1.5">
                <Label>모델</Label>
                <Select
                    value={params.model}
                    onValueChange={(v) => v && set('model', v as ProjectParams['model'])}
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

            {isV5 && (
                <p className="text-xs text-muted-foreground">
                    V5는 Karras를 사용하며 Variety+, 바이브 전송, 캐릭터 레퍼런스를 지원하지
                    않습니다.
                </p>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sidebar-parameter-width">너비</Label>
                    <Input
                        id="sidebar-parameter-width"
                        type="number"
                        value={params.width}
                        min={64}
                        max={2048}
                        step={64}
                        onChange={(event) => set('width', Number(event.target.value))}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sidebar-parameter-height">높이</Label>
                    <Input
                        id="sidebar-parameter-height"
                        type="number"
                        value={params.height}
                        min={64}
                        max={2048}
                        step={64}
                        onChange={(event) => set('height', Number(event.target.value))}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Label>스텝</Label>
                    <span className="text-xs text-muted-foreground">{params.steps}</span>
                </div>
                <Slider
                    value={[params.steps]}
                    min={1}
                    max={50}
                    step={1}
                    onValueChange={(value) => set('steps', sliderValue(value, params.steps))}
                />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Label>CFG Scale</Label>
                    <span className="text-xs text-muted-foreground">{params.promptGuidance}</span>
                </div>
                <Slider
                    value={[params.promptGuidance]}
                    min={1}
                    max={10}
                    step={0.1}
                    onValueChange={(value) =>
                        set('promptGuidance', sliderValue(value, params.promptGuidance))
                    }
                />
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <Label>CFG Rescale</Label>
                    <span className="text-xs text-muted-foreground">
                        {params.promptGuidanceRescale}
                    </span>
                </div>
                <Slider
                    value={[params.promptGuidanceRescale]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={(value) =>
                        set(
                            'promptGuidanceRescale',
                            sliderValue(value, params.promptGuidanceRescale),
                        )
                    }
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="sidebar-parameter-seed">시드 (0 = 랜덤)</Label>
                <Input
                    id="sidebar-parameter-seed"
                    type="number"
                    value={params.seed}
                    min={0}
                    onChange={(event) => set('seed', Number(event.target.value))}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <Label>샘플러</Label>
                <Select
                    value={params.sampler}
                    onValueChange={(v) => v && set('sampler', v as ProjectParams['sampler'])}
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
                    value={isV5 ? 'karras' : params.noiseSchedule}
                    disabled={isV5}
                    onValueChange={(v) =>
                        v && set('noiseSchedule', v as ProjectParams['noiseSchedule'])
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

            <div className="flex flex-col gap-3">
                {(
                    [
                        ['qualityToggle', 'Quality Toggle'],
                        ['varietyPlus', 'Variety+'],
                        ['useCharacterPositions', '캐릭터 위치 사용'],
                    ] as const
                ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                        <Label>{label}</Label>
                        <Switch
                            checked={key === 'varietyPlus' && isV5 ? false : params[key]}
                            disabled={key === 'varietyPlus' && isV5}
                            onCheckedChange={(v) => set(key, v)}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

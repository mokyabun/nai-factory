import {
    FREE_GENERATION_MAX_STEPS,
    isFreeGeneration,
    isNovelAIV5Model,
    NOVEL_AI_MODEL_OPTIONS,
    NOVEL_AI_NOISE_SCHEDULE_OPTIONS,
    NOVEL_AI_SAMPLER_OPTIONS,
    type Parameters,
} from '@nai-factory/shared'

import { LabeledSlider, NumberField, SelectField, ToggleRow } from '@/components/form-fields'
import { Badge } from '@/components/ui/badge'

import { ImageSizeField } from './image-size-field'

interface ParametersFormProps {
    parameters: Parameters
    onChange: <K extends keyof Parameters>(key: K, value: Parameters[K]) => void
    /** Projects also use references; Playground does not. */
    scope: 'project' | 'playground'
}

export function ParametersForm({ parameters, onChange, scope }: ParametersFormProps) {
    const isV5 = isNovelAIV5Model(parameters.model)
    const id = (field: string) => `${scope}-parameter-${field}`

    return (
        <div className="flex flex-col gap-5 pb-4">
            <SelectField
                label="모델"
                value={parameters.model}
                options={NOVEL_AI_MODEL_OPTIONS}
                onChange={(value) => onChange('model', value)}
            />

            {isV5 && (
                <p className="text-xs text-muted-foreground">
                    {scope === 'project'
                        ? 'V5는 Karras를 사용하며 Variety+, 바이브 전송, 캐릭터 레퍼런스를 지원하지 않습니다.'
                        : 'V5는 Karras를 사용하며 Variety+를 지원하지 않습니다.'}
                </p>
            )}

            {!isFreeGeneration(parameters) && (
                <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="shrink-0">
                        Anlas 소모
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                        1024×1024 픽셀 또는 {FREE_GENERATION_MAX_STEPS} 스텝을 넘으면 Opus
                        구독에서도 Anlas를 소모합니다.
                    </p>
                </div>
            )}

            <ImageSizeField
                idPrefix={id('size')}
                width={parameters.width}
                height={parameters.height}
                onChange={(size) => {
                    onChange('width', size.width)
                    onChange('height', size.height)
                }}
            />

            <LabeledSlider
                label="스텝"
                value={parameters.steps}
                min={1}
                max={50}
                step={1}
                onChange={(value) => onChange('steps', value)}
            />
            <LabeledSlider
                label="CFG Scale"
                value={parameters.promptGuidance}
                min={1}
                max={10}
                step={0.1}
                onChange={(value) => onChange('promptGuidance', value)}
            />
            <LabeledSlider
                label="CFG Rescale"
                value={parameters.promptGuidanceRescale}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => onChange('promptGuidanceRescale', value)}
            />

            <NumberField
                id={id('seed')}
                label="시드 (0 = 랜덤)"
                value={parameters.seed}
                min={0}
                onChange={(value) => onChange('seed', value)}
            />

            <SelectField
                label="샘플러"
                value={parameters.sampler}
                options={NOVEL_AI_SAMPLER_OPTIONS}
                onChange={(value) => onChange('sampler', value)}
            />
            <SelectField
                label="노이즈 스케줄"
                value={isV5 ? 'karras' : parameters.noiseSchedule}
                options={NOVEL_AI_NOISE_SCHEDULE_OPTIONS}
                disabled={isV5}
                onChange={(value) => onChange('noiseSchedule', value)}
            />

            <div className="flex flex-col gap-3">
                <ToggleRow
                    label="Quality Toggle"
                    checked={parameters.qualityToggle}
                    onChange={(checked) => onChange('qualityToggle', checked)}
                />
                <ToggleRow
                    label="Variety+"
                    checked={!isV5 && parameters.varietyPlus}
                    disabled={isV5}
                    onChange={(checked) => onChange('varietyPlus', checked)}
                />
            </div>
        </div>
    )
}

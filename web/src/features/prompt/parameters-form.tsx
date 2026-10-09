import {
    isNovelAIV5Model,
    NOVEL_AI_MODEL_OPTIONS,
    NOVEL_AI_NOISE_SCHEDULE_OPTIONS,
    NOVEL_AI_SAMPLER_OPTIONS,
    type Parameters,
} from '@nai-factory/shared'

import { LabeledSlider, NumberField, SelectField, ToggleRow } from '@/components/form-fields'

interface ParametersFormProps {
    parameters: Parameters
    onChange: <K extends keyof Parameters>(key: K, value: Parameters[K]) => void
    /** Projects also place characters and use references; Playground does neither. */
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

            <div className="grid grid-cols-2 gap-3">
                <NumberField
                    id={id('width')}
                    label="너비"
                    value={parameters.width}
                    min={64}
                    max={2048}
                    step={64}
                    onChange={(value) => onChange('width', value)}
                />
                <NumberField
                    id={id('height')}
                    label="높이"
                    value={parameters.height}
                    min={64}
                    max={2048}
                    step={64}
                    onChange={(value) => onChange('height', value)}
                />
            </div>

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
                {scope === 'project' && (
                    <ToggleRow
                        label="캐릭터 위치 사용"
                        checked={parameters.useCharacterPositions}
                        onChange={(checked) => onChange('useCharacterPositions', checked)}
                    />
                )}
            </div>
        </div>
    )
}

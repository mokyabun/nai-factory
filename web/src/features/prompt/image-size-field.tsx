import { IMAGE_SIZE_MAX, IMAGE_SIZE_MIN, IMAGE_SIZE_STEP } from '@nai-factory/shared'
import { useState } from 'react'

import { NumberField, SelectField } from '@/components/form-fields'

const SIZE_PRESETS = [
    { value: 'portrait', label: '세로 832×1216', width: 832, height: 1216 },
    { value: 'landscape', label: '가로 1216×832', width: 1216, height: 832 },
    { value: 'square', label: '정사각 1024×1024', width: 1024, height: 1024 },
] as const

type SizeOption = (typeof SIZE_PRESETS)[number]['value'] | 'custom'

const SIZE_OPTIONS: readonly { value: SizeOption; label: string }[] = [
    ...SIZE_PRESETS,
    { value: 'custom', label: '직접 입력' },
]

interface ImageSizeFieldProps {
    idPrefix: string
    width: number
    height: number
    onChange: (size: { width: number; height: number }) => void
}

export function ImageSizeField({ idPrefix, width, height, onChange }: ImageSizeFieldProps) {
    const matchingPreset = SIZE_PRESETS.find(
        (preset) => preset.width === width && preset.height === height,
    )
    const [customPicked, setCustomPicked] = useState(false)
    const selected: SizeOption = customPicked || !matchingPreset ? 'custom' : matchingPreset.value

    function selectOption(value: SizeOption) {
        const preset = SIZE_PRESETS.find((item) => item.value === value)
        setCustomPicked(!preset)
        if (preset) onChange({ width: preset.width, height: preset.height })
    }

    function editSize(size: { width: number; height: number }) {
        setCustomPicked(true)
        onChange(size)
    }

    return (
        <div className="flex flex-col gap-3">
            <SelectField
                label="크기"
                value={selected}
                options={SIZE_OPTIONS}
                onChange={selectOption}
            />
            {selected === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                    <NumberField
                        id={`${idPrefix}-width`}
                        label="너비"
                        value={width}
                        min={IMAGE_SIZE_MIN}
                        max={IMAGE_SIZE_MAX}
                        step={IMAGE_SIZE_STEP}
                        onChange={(value) => editSize({ width: value, height })}
                    />
                    <NumberField
                        id={`${idPrefix}-height`}
                        label="높이"
                        value={height}
                        min={IMAGE_SIZE_MIN}
                        max={IMAGE_SIZE_MAX}
                        step={IMAGE_SIZE_STEP}
                        onChange={(value) => editSize({ width, height: value })}
                    />
                </div>
            )}
        </div>
    )
}

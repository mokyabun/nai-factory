import { MAX_IMAGES_PER_JOB } from '@nai-factory/shared'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function clampImageCount(value: number) {
    return Math.min(MAX_IMAGES_PER_JOB, Math.max(1, Math.round(value) || 1))
}

interface ImageCountInputProps {
    id?: string
    value: number
    onChange: (value: number) => void
    className?: string
}

export function ImageCountInput({ id, value, onChange, className }: ImageCountInputProps) {
    return (
        <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_IMAGES_PER_JOB}
            value={value}
            aria-label="이미지 수"
            title="변수 세트마다 생성할 이미지 수"
            onChange={(event) => onChange(clampImageCount(Number(event.target.value)))}
            className={cn('w-16 tabular-nums', className)}
        />
    )
}

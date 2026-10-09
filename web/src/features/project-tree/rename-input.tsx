import { useRef } from 'react'

import { Input } from '@/components/ui/input'

interface RenameInputProps {
    className?: string
    value: string
    stopClickPropagation?: boolean
    onChange: (value: string) => void
    onCommit: () => void
    onCancel: () => void
}

export function RenameInput({
    className,
    value,
    stopClickPropagation = false,
    onChange,
    onCommit,
    onCancel,
}: RenameInputProps) {
    const skipBlurCommit = useRef(false)

    return (
        <Input
            className={className}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
                if (skipBlurCommit.current) {
                    skipBlurCommit.current = false
                    return
                }
                onCommit()
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCommit()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCancel()
                }
            }}
            autoFocus
            onClick={stopClickPropagation ? (event) => event.stopPropagation() : undefined}
        />
    )
}

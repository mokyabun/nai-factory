import { FileUp, type LucideIcon, X } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
    icon: LucideIcon
    title: string
    description: string
    children: React.ReactNode
}

export function SettingsSection({
    icon: Icon,
    title,
    description,
    children,
}: SettingsSectionProps) {
    return (
        <section className="border">
            <header className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </header>
            <div className="flex flex-col gap-3 p-4">{children}</div>
        </section>
    )
}

interface FilePickerProps {
    accept: string
    placeholder: string
    file: File | null
    disabled?: boolean
    onChange: (file: File | null) => void
    className?: string
}

export function FilePicker({
    accept,
    placeholder,
    file,
    disabled,
    onChange,
    className,
}: FilePickerProps) {
    const id = useId()

    return (
        <div
            className={cn(
                'flex h-9 min-w-0 items-center border border-dashed transition-colors hover:border-ring hover:bg-muted/50',
                file && 'border-solid',
                disabled && 'pointer-events-none opacity-50',
                className,
            )}
        >
            <label
                htmlFor={id}
                className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 text-sm"
            >
                <FileUp className="size-4 shrink-0 text-muted-foreground" />
                <span className={cn('truncate', !file && 'text-muted-foreground')}>
                    {file?.name ?? placeholder}
                </span>
            </label>
            {file && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="mr-1"
                    aria-label="파일 선택 취소"
                    onClick={() => onChange(null)}
                >
                    <X />
                </Button>
            )}
            <input
                id={id}
                type="file"
                accept={accept}
                disabled={disabled}
                className="sr-only"
                onChange={(event) => {
                    onChange(event.target.files?.[0] ?? null)
                    event.target.value = ''
                }}
            />
        </div>
    )
}

export function usePendingTask<Task extends string>() {
    const [pending, setPending] = useState<Task | null>(null)

    async function run(task: Task, action: () => Promise<void>, successMessage: string) {
        setPending(task)
        try {
            await action()
            toast.success(successMessage)
        } catch (error) {
            toast.error(errorMessage(error, '작업 실패'))
        } finally {
            setPending(null)
        }
    }

    return { pending, run }
}

import { ArrowDownToLine, FlaskConical, Loader, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'

interface PlaygroundHeaderProps {
    isDisabled: boolean
    pendingAction: 'generate' | 'enqueue' | null
    errorMessage: string | null
    /** Waiting jobs that will also run once "generate now" starts the paused queue. */
    resumedJobCount: number
    onGenerate: () => void
    onEnqueue: () => void
}

export function PlaygroundHeader({
    isDisabled,
    pendingAction,
    errorMessage,
    resumedJobCount,
    onGenerate,
    onEnqueue,
}: PlaygroundHeaderProps) {
    const spinner = <Loader className="h-3.5 w-3.5 animate-spin" />

    return (
        <SidebarHeader className="border-b">
            <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                <FlaskConical className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-md font-bold">Playground</span>
            </div>
            <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={onGenerate}
                    disabled={isDisabled}
                    title="대기 중인 작업보다 먼저 생성합니다"
                >
                    {pendingAction === 'generate' ? spinner : <Sparkles className="h-3.5 w-3.5" />}
                    지금 생성
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={onEnqueue}
                    disabled={isDisabled}
                    title="대기열 끝에 추가만 하고 시작하지 않습니다"
                >
                    {pendingAction === 'enqueue' ? (
                        spinner
                    ) : (
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                    )}
                    대기열에 추가
                </Button>
            </div>
            {errorMessage ? (
                <p className="px-1 pb-1 text-xs text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : (
                resumedJobCount > 0 && (
                    <p className="px-1 pb-1 text-xs text-muted-foreground">
                        지금 생성하면 대기 중인 작업 {resumedJobCount}개도 이어서 실행됩니다
                    </p>
                )
            )}
        </SidebarHeader>
    )
}

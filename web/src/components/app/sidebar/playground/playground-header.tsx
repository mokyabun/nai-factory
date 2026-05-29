import type { EnqueuePosition } from '@nai-factory/shared'
import { ArrowDownToLine, ArrowUpToLine, FlaskConical, Loader } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarHeader } from '@/components/ui/sidebar'

interface PlaygroundHeaderProps {
    isEnqueueDisabled: boolean
    isEnqueuePending: boolean
    onEnqueue: (position: EnqueuePosition) => void
}

export function PlaygroundHeader({
    isEnqueueDisabled,
    isEnqueuePending,
    onEnqueue,
}: PlaygroundHeaderProps) {
    const icon = isEnqueuePending ? (
        <Loader className="h-3.5 w-3.5 animate-spin" />
    ) : (
        <ArrowUpToLine className="h-3.5 w-3.5" />
    )

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
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => onEnqueue('front')}
                    disabled={isEnqueueDisabled}
                >
                    {icon}
                    앞에 추가
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => onEnqueue('back')}
                    disabled={isEnqueueDisabled}
                >
                    {isEnqueuePending ? (
                        <Loader className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                    )}
                    뒤에 추가
                </Button>
            </div>
        </SidebarHeader>
    )
}

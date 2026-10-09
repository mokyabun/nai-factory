import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Check, Copy, FlaskConical, Recycle, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApplyGenerationSettings } from '@/hooks/use-apply-generation-settings'
import {
    type GenerationSettings,
    playgroundUnsupportedNotice,
    readGenerationSettings,
    type SeedMode,
} from '@/lib/generation-settings'
import { cn } from '@/lib/utils'

type Feedback = { kind: 'success' | 'error'; message: string }

interface ImageReuseMenuProps {
    metadata: Record<string, unknown>
    /** Where the image came from: Playground results reload Playground; scene results can also update their project. */
    source: { type: 'playground' } | { type: 'scene'; projectId: number }
    triggerClassName?: string
}

export function ImageReuseMenu({ metadata, source, triggerClassName }: ImageReuseMenuProps) {
    const navigate = useNavigate()
    const { toPlayground, toProject } = useApplyGenerationSettings()
    const settings = useMemo(() => readGenerationSettings(metadata), [metadata])
    const unsupported = playgroundUnsupportedNotice(settings)
    const [feedback, setFeedback] = useState<Feedback | null>(null)

    useEffect(() => {
        if (!feedback) return
        const timer = window.setTimeout(() => setFeedback(null), 2500)
        return () => window.clearTimeout(timer)
    }, [feedback])

    function report(promise: Promise<unknown>, message: string) {
        promise.then(
            () => setFeedback({ kind: 'success', message }),
            (error: unknown) =>
                setFeedback({
                    kind: 'error',
                    message: error instanceof Error ? error.message : '적용하지 못했습니다',
                }),
        )
    }

    function applyToPlayground(nextSettings: GenerationSettings, seedMode: SeedMode) {
        const applied = toPlayground.mutateAsync({ settings: nextSettings, seedMode })
        report(applied, 'Playground에 불러왔습니다')
        if (source.type === 'scene') {
            void applied.then(() => navigate({ to: '/playground' }))
        }
    }

    function copySeed() {
        if (settings.seed === null) return
        report(navigator.clipboard.writeText(String(settings.seed)), '시드를 복사했습니다')
    }

    const pending = toPlayground.isPending || toProject.isPending

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={pending}
                className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors disabled:opacity-50',
                    triggerClassName,
                )}
                title={feedback?.message}
            >
                {feedback?.kind === 'success' ? (
                    <Check className="h-4 w-4" />
                ) : feedback?.kind === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                    <Recycle className="h-4 w-4" />
                )}
                <span aria-live="polite">{feedback?.message ?? '재사용'}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Playground</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => applyToPlayground(settings, 'random')}>
                        <FlaskConical />
                        프롬프트·설정 불러오기 (시드 랜덤)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => applyToPlayground(settings, 'image')}
                        disabled={settings.seed === null}
                    >
                        <FlaskConical />
                        프롬프트·설정·시드 불러오기
                    </DropdownMenuItem>
                    {unsupported && (
                        <p className="px-2 pb-2 text-[11px] leading-snug text-muted-foreground">
                            {unsupported}
                        </p>
                    )}
                </DropdownMenuGroup>

                {source.type === 'scene' && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>프로젝트 (프롬프트는 유지)</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() =>
                                    report(
                                        toProject.mutateAsync({
                                            projectId: source.projectId,
                                            settings,
                                            seedMode: 'keep',
                                        }),
                                        '프로젝트에 적용했습니다',
                                    )
                                }
                            >
                                <SlidersHorizontal />
                                파라미터 적용
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    report(
                                        toProject.mutateAsync({
                                            projectId: source.projectId,
                                            settings,
                                            seedMode: 'image',
                                        }),
                                        '프로젝트에 적용했습니다',
                                    )
                                }
                                disabled={settings.seed === null}
                            >
                                <SlidersHorizontal />
                                파라미터·시드 적용 (모든 씬 같은 시드)
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copySeed} disabled={settings.seed === null}>
                    <Copy />
                    {settings.seed === null ? '기록된 시드 없음' : `시드 복사 (${settings.seed})`}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

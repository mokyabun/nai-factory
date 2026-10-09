import type { SceneImportMode, SceneJsonData, SceneSummary } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileJson } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { optimisticSceneSummaries } from '@/lib/optimistic-scenes'
import { qk } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface SceneJsonImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    data: SceneJsonData | null
    projectId: number | null
}

const MODE_OPTIONS: Array<{
    value: SceneImportMode
    label: string
    description: string
}> = [
    {
        value: 'append',
        label: '추가',
        description: '현재 씬 뒤에 JSON 씬을 추가합니다.',
    },
    {
        value: 'replace',
        label: '덮어쓰기',
        description: '현재 프로젝트의 기존 씬을 지우고 JSON 씬으로 교체합니다.',
    },
]

export function SceneJsonImportDialog({
    open,
    onOpenChange,
    data,
    projectId,
}: SceneJsonImportDialogProps) {
    const queryClient = useQueryClient()
    const [mode, setMode] = useState<SceneImportMode>('append')
    // Every opening starts from the default mode.
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) setMode('append')
    }

    const importSceneJson = useMutation({
        mutationFn: async () => {
            if (!data || projectId === null) throw new Error('가져올 수 없습니다.')
            return call(contract.scenes.importJson, { body: { projectId, data, mode } })
        },
        onMutate: async () => {
            if (!data || projectId === null) return null
            const previousScenes = await snapshotQuery<SceneSummary[]>(
                queryClient,
                qk.scenes.list(projectId),
            )
            const optimisticScenes = optimisticSceneSummaries(projectId, sceneJsonItems(data))
            queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(projectId), (scenes) =>
                mode === 'replace' ? optimisticScenes : [...(scenes ?? []), ...optimisticScenes],
            )
            return { previousScenes }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousScenes)
        },
        onSuccess: async () => {
            if (projectId !== null) {
                await queryClient.invalidateQueries({ queryKey: qk.scenes.list(projectId) })
            }
            onOpenChange(false)
        },
    })

    const isPending = importSceneJson.isPending
    const sceneCount = data ? countSceneJsonItems(data) : 0

    function handleOpenChange(nextOpen: boolean) {
        if (isPending) return
        onOpenChange(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="size-4" />
                        Scene JSON 가져오기
                    </DialogTitle>
                    <DialogDescription>
                        씬 {sceneCount}개를 현재 프로젝트로 가져옵니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                    {MODE_OPTIONS.map((option) => (
                        <Button
                            key={option.value}
                            type="button"
                            variant="outline"
                            className={cn(
                                'h-auto flex-col items-start gap-1 px-3 py-2 text-left',
                                mode === option.value && 'border-primary bg-primary/5',
                            )}
                            onClick={() => setMode(option.value)}
                            disabled={isPending}
                        >
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                                {option.description}
                            </span>
                        </Button>
                    ))}
                </div>

                {importSceneJson.isError && (
                    <p className="text-xs text-destructive">
                        {importSceneJson.error instanceof Error
                            ? importSceneJson.error.message
                            : '가져오기에 실패했습니다.'}
                    </p>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        onClick={() => importSceneJson.mutate()}
                        disabled={!data || projectId === null || isPending}
                    >
                        {isPending ? '가져오는 중...' : '가져오기'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function countSceneJsonItems(data: SceneJsonData) {
    if (Array.isArray(data)) return data.length
    if ('scenes' in data) return data.scenes.length
    return 1
}

function sceneJsonItems(data: SceneJsonData) {
    if (Array.isArray(data)) return data
    if ('scenes' in data) return data.scenes
    return [data]
}

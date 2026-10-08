import type { SceneJsonData, SceneJsonImportMode } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileJson } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { api, type SceneSummary } from '@/lib/api'
import { requireApiResult, restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface SceneJsonImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    data: SceneJsonData | null
    projectId: number | null
}

const MODE_OPTIONS: Array<{
    value: SceneJsonImportMode
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
    const [mode, setMode] = useState<SceneJsonImportMode>('append')

    useEffect(() => {
        // eslint-disable-next-line react/set-state-in-effect -- Synchronize the local draft with externally loaded data or dialog state.
        if (open) setMode('append')
    }, [open])

    const importSceneJson = useMutation({
        mutationFn: async () => {
            if (!data || projectId === null) throw new Error('가져올 수 없습니다.')

            const { data: result } = await requireApiResult(
                api.scenes['import-json'].post({
                    projectId,
                    data,
                    mode,
                }),
            )
            return result
        },
        onMutate: async () => {
            if (!data || projectId === null) return null
            const previousScenes = await snapshotQuery<SceneSummary[]>(
                queryClient,
                qk.scenes(projectId),
            )
            const now = new Date().toISOString()
            const optimisticScenes = sceneJsonItems(data).map((scene, index) => ({
                id: -(Date.now() + index),
                projectId,
                displayOrder: `optimistic-${now}-${index}`,
                name: scene.name,
                variations: scene.variations.map((variation, variationIndex) => ({
                    id: -(Date.now() + index * 100 + variationIndex),
                    sceneId: -(Date.now() + index),
                    displayOrder: String(variationIndex),
                    variables: variation.variables,
                    createdAt: now,
                    updatedAt: now,
                })),
                createdAt: now,
                updatedAt: now,
                imageCount: 0,
                queueCount: 0,
                latestImages: [],
            }))
            queryClient.setQueryData<SceneSummary[]>(qk.scenes(projectId), (scenes) =>
                mode === 'replace' ? optimisticScenes : [...(scenes ?? []), ...optimisticScenes],
            )
            return { previousScenes }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousScenes)
        },
        onSuccess: async (result, _variables, context) => {
            if (projectId !== null) {
                if (result?.scenes) {
                    const scenes = result.scenes.map((scene) => ({
                        ...scene,
                        imageCount: 0,
                        queueCount: 0,
                        latestImages: [],
                    }))
                    const previousScenes = context?.previousScenes.data ?? []
                    queryClient.setQueryData<SceneSummary[]>(
                        qk.scenes(projectId),
                        mode === 'replace' ? scenes : [...previousScenes, ...scenes],
                    )
                }
                await queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
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

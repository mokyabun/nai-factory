import type { Project, SceneImportMode, SceneSummary } from '@nai-factory/shared'
import { SceneJsonData } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileDown, FileUp, Upload } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { optimisticSceneSummaries } from '@/lib/optimistic-scenes'
import { qk } from '@/lib/queries'
import { cn } from '@/lib/utils'

import { downloadBlob, sanitizeFilename, sceneJsonItems } from './project-files'
import { FilePicker, SettingsSection, usePendingTask } from './settings-section'

interface SceneJsonSettingsProps {
    project: Project | null
    scenes: SceneSummary[]
    selectedSceneIds: number[]
}

const IMPORT_MODE_OPTIONS: Array<{
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
        description: '기존 씬을 모두 지우고 JSON 씬으로 교체합니다.',
    },
]

export function SceneJsonSettings({ project, scenes, selectedSceneIds }: SceneJsonSettingsProps) {
    const queryClient = useQueryClient()
    const { pending, run } = usePendingTask<'export' | 'import'>()
    const [file, setFile] = useState<File | null>(null)
    const [mode, setMode] = useState<SceneImportMode>('append')

    async function exportSceneJson() {
        if (!project) return
        const sceneIds = selectedSceneIds.length > 0 ? selectedSceneIds : undefined
        const data = await call(contract.scenes.exportJson, {
            body: { projectId: project.id, sceneIds },
        })

        downloadBlob(
            new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
            `${sanitizeFilename(project.name)}-scenes.json`,
        )
    }

    async function importSceneJson() {
        if (!project || !file) return

        const raw = JSON.parse(await file.text()) as unknown
        const parsed = SceneJsonData.safeParse(raw)
        if (!parsed.success) throw new Error('Scene JSON 파일이 아닙니다.')

        const previousScenes = await snapshotQuery<SceneSummary[]>(
            queryClient,
            qk.scenes.list(project.id),
        )
        const optimisticScenes = optimisticSceneSummaries(project.id, sceneJsonItems(parsed.data))
        queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(project.id), (current) =>
            mode === 'replace' ? optimisticScenes : [...(current ?? []), ...optimisticScenes],
        )

        try {
            await call(contract.scenes.importJson, {
                body: { projectId: project.id, data: parsed.data, mode },
            })
        } catch (error) {
            restoreSnapshot(queryClient, previousScenes)
            throw error
        }

        setFile(null)
        await queryClient.invalidateQueries({ queryKey: qk.scenes.list(project.id) })
    }

    const busy = pending !== null
    const exportTarget =
        selectedSceneIds.length > 0
            ? `선택한 씬 ${selectedSceneIds.length}개`
            : `전체 씬 ${scenes.length}개`
    const modeDescription = IMPORT_MODE_OPTIONS.find((option) => option.value === mode)?.description

    return (
        <div className="flex flex-col gap-4">
            <SettingsSection
                icon={FileDown}
                title="씬 내보내기"
                description="씬 이름과 variation을 JSON 파일로 저장합니다."
            >
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{exportTarget}</span>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!project || scenes.length === 0 || busy}
                        onClick={() => run('export', exportSceneJson, 'Export 완료')}
                    >
                        <Download />
                        {pending === 'export' ? '생성 중...' : 'JSON 다운로드'}
                    </Button>
                </div>
            </SettingsSection>

            <SettingsSection
                icon={FileUp}
                title="씬 가져오기"
                description="JSON 파일의 씬을 현재 프로젝트로 가져옵니다."
            >
                <FilePicker
                    accept=".json,application/json"
                    placeholder="JSON 파일 선택"
                    file={file}
                    disabled={busy}
                    onChange={setFile}
                />
                <div className="flex items-center gap-2">
                    <div className="grid flex-1 grid-cols-2 border p-0.5">
                        {IMPORT_MODE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={mode === option.value}
                                className={cn(
                                    'h-7 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
                                    mode === option.value &&
                                        (option.value === 'replace'
                                            ? 'bg-destructive/15 text-destructive hover:text-destructive'
                                            : 'bg-muted text-foreground'),
                                )}
                                onClick={() => setMode(option.value)}
                                disabled={busy}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        type="button"
                        variant={mode === 'replace' ? 'destructive' : 'outline'}
                        disabled={!project || !file || busy}
                        onClick={() => run('import', importSceneJson, 'Import 완료')}
                    >
                        <Upload />
                        {pending === 'import' ? '가져오는 중...' : '가져오기'}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">{modeDescription}</p>
            </SettingsSection>
        </div>
    )
}

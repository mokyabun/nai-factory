import type { Project, ProjectArchiveExportBody, SceneJsonImportMode } from '@nai-factory/shared'
import { DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS, SceneJsonData } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Download, FileJson, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api, type SceneSummary } from '@/lib/api'
import { qk } from '@/lib/queries'
import { cn } from '@/lib/utils'

interface ProjectFilesSettingsProps {
    onImported: () => void
    project: Project | null
    scenes: SceneSummary[]
    selectedSceneIds: number[]
}

type PendingMethod = 'scene-json-export' | 'scene-json-import' | 'archive' | 'import'

const SCENE_JSON_IMPORT_MODE_OPTIONS: Array<{
    value: SceneJsonImportMode
    label: string
    description: string
}> = [
    {
        value: 'append',
        label: '추가',
        description: '현재 씬 뒤에 JSON 씬을 추가',
    },
    {
        value: 'replace',
        label: '덮어쓰기',
        description: '기존 씬을 지우고 JSON 씬으로 교체',
    },
]

export function ProjectFilesSettings({
    onImported,
    project,
    scenes,
    selectedSceneIds,
}: ProjectFilesSettingsProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [archiveInclude, setArchiveInclude] = useState(DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS)
    const [sceneJsonFile, setSceneJsonFile] = useState<File | null>(null)
    const [sceneJsonMode, setSceneJsonMode] = useState<SceneJsonImportMode>('append')
    const [importFile, setImportFile] = useState<File | null>(null)
    const [pendingMethod, setPendingMethod] = useState<PendingMethod | null>(null)
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!project) return
        setArchiveInclude(DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS)
        setSceneJsonFile(null)
        setSceneJsonMode('append')
        setImportFile(null)
        setMessage('')
    }, [project])

    function archiveBody(): ProjectArchiveExportBody {
        return { include: archiveInclude }
    }

    function updateArchiveInclude(key: keyof typeof archiveInclude, checked: boolean) {
        setArchiveInclude((current) => ({ ...current, [key]: checked }))
    }

    async function exportSceneJson() {
        if (!project) return
        const sceneIds = selectedSceneIds.length > 0 ? selectedSceneIds : undefined
        const { data, error } = await api.scenes['export-json'].post({
            projectId: project.id,
            sceneIds,
        })
        if (error || !data) throw new Error('Scene JSON export failed')

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${sanitizeFilename(project.name)}-scenes.json`
        link.click()
        URL.revokeObjectURL(url)
    }

    async function importSceneJson() {
        if (!project || !sceneJsonFile) return

        const raw = JSON.parse(await sceneJsonFile.text()) as unknown
        const parsed = SceneJsonData.safeParse(raw)
        if (!parsed.success) throw new Error('Scene JSON 파일이 아닙니다.')

        const { error } = await api.scenes['import-json'].post({
            projectId: project.id,
            data: parsed.data,
            mode: sceneJsonMode,
        })
        if (error) throw new Error('Scene JSON import failed')

        await queryClient.invalidateQueries({ queryKey: qk.scenes(project.id) })
    }

    async function exportProjectArchive() {
        if (!project) return
        const { data, error } = await api
            .projects({ projectId: project.id })
            .archive.post(archiveBody())
        if (error || !data) throw new Error('Project archive export failed')

        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = `${sanitizeFilename(project.name)}.naif`
        link.click()
        URL.revokeObjectURL(url)
    }

    async function importProjectArchive() {
        if (!importFile) return

        const { data, error } = await api.projects.import.post({ archive: importFile })
        if (error || !data) throw new Error('Project archive import failed')

        await queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
        queryClient.setQueryData(qk.project(data.id), data)
        onImported()
        navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
    }

    async function run(method: PendingMethod) {
        setPendingMethod(method)
        setMessage('')

        try {
            if (method === 'scene-json-export') await exportSceneJson()
            else if (method === 'scene-json-import') await importSceneJson()
            else if (method === 'archive') await exportProjectArchive()
            else await importProjectArchive()

            setMessage(
                method === 'import' || method === 'scene-json-import'
                    ? 'Import 완료'
                    : 'Export 완료',
            )
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '작업 실패')
        } finally {
            setPendingMethod(null)
        }
    }

    const archiveDisabled = !project || pendingMethod !== null
    const importDisabled = !importFile || pendingMethod !== null
    const sceneJsonImportDisabled = !project || !sceneJsonFile || pendingMethod !== null
    const sceneJsonDisabled = !project || scenes.length === 0 || pendingMethod !== null
    const sceneJsonTargetCount =
        selectedSceneIds.length > 0 ? selectedSceneIds.length : scenes.length

    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-medium">Scene JSON</h3>
                        <p className="text-xs text-muted-foreground">
                            씬 이름과 variation을 JSON으로 내보내기 / 가져오기
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={sceneJsonDisabled}
                        onClick={() => run('scene-json-export')}
                    >
                        <FileJson className="h-4 w-4" />
                        {pendingMethod === 'scene-json-export' ? '생성 중...' : 'JSON 다운로드'}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">대상 씬 {sceneJsonTargetCount}개</p>

                <div className="grid gap-3 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                            <h4 className="text-xs font-medium">Scene JSON 가져오기</h4>
                            <p className="text-xs text-muted-foreground">
                                JSON 씬을 현재 프로젝트로 가져오기
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            disabled={sceneJsonImportDisabled}
                            onClick={() => run('scene-json-import')}
                        >
                            <Upload className="h-4 w-4" />
                            {pendingMethod === 'scene-json-import' ? '가져오는 중...' : '가져오기'}
                        </Button>
                    </div>

                    <Input
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => setSceneJsonFile(event.target.files?.[0] ?? null)}
                    />

                    <div className="grid gap-2 sm:grid-cols-2">
                        {SCENE_JSON_IMPORT_MODE_OPTIONS.map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                variant="outline"
                                className={cn(
                                    'h-auto flex-col items-start gap-1 px-3 py-2 text-left',
                                    sceneJsonMode === option.value && 'border-primary bg-primary/5',
                                )}
                                onClick={() => setSceneJsonMode(option.value)}
                                disabled={pendingMethod !== null}
                            >
                                <span className="font-medium">{option.label}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    {option.description}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>
            </section>

            <div className="border-t" />

            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-medium">Project Archive</h3>
                        <p className="text-xs text-muted-foreground">
                            프로젝트를 .naif 파일 하나로 다운로드
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        disabled={archiveDisabled}
                        onClick={() => run('archive')}
                    >
                        <Download className="h-4 w-4" />
                        {pendingMethod === 'archive' ? '생성 중...' : '.naif 다운로드'}
                    </Button>
                </div>

                <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-2">
                    <ArchiveOption
                        id="archive-prompts"
                        label="프롬프트"
                        description="프롬프트 + 캐릭터 프롬프트 + 변수"
                        checked={archiveInclude.prompts}
                        onChange={(checked) => updateArchiveInclude('prompts', checked)}
                    />
                    <ArchiveOption
                        id="archive-parameters"
                        label="파라미터"
                        description="모델, 해상도, 샘플러 등 생성 설정"
                        checked={archiveInclude.parameters}
                        onChange={(checked) => updateArchiveInclude('parameters', checked)}
                    />
                    <ArchiveOption
                        id="archive-scenes"
                        label="씬"
                        description="씬 + 씬 변수"
                        checked={archiveInclude.scenes}
                        onChange={(checked) => updateArchiveInclude('scenes', checked)}
                    />
                    <ArchiveOption
                        id="archive-character-references"
                        label="캐릭터 레퍼런스"
                        description="원본 + 가공 데이터"
                        checked={archiveInclude.characterReferences}
                        onChange={(checked) => updateArchiveInclude('characterReferences', checked)}
                    />
                    <ArchiveOption
                        id="archive-vibe-transfers"
                        label="바이브 트랜스퍼"
                        description="원본 + 가공 데이터"
                        checked={archiveInclude.vibeTransfers}
                        onChange={(checked) => updateArchiveInclude('vibeTransfers', checked)}
                    />
                    <ArchiveOption
                        id="archive-images"
                        label="결과 이미지"
                        description="이미지 + 썸네일"
                        checked={archiveInclude.images}
                        disabled={!archiveInclude.scenes}
                        onChange={(checked) => updateArchiveInclude('images', checked)}
                    />
                </div>
            </section>

            <div className="border-t" />

            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-sm font-medium">Import .naif</h3>
                        <p className="text-xs text-muted-foreground">
                            아카이브를 새 프로젝트로 가져오기
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        disabled={importDisabled}
                        onClick={() => run('import')}
                    >
                        <Upload className="h-4 w-4" />
                        {pendingMethod === 'import' ? '가져오는 중...' : '가져오기'}
                    </Button>
                </div>

                <Input
                    type="file"
                    accept=".naif,application/zip,application/vnd.nai-factory.project+zip"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
            </section>

            {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
    )
}

interface ArchiveOptionProps {
    id: string
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (checked: boolean) => void
}

function ArchiveOption({
    id,
    label,
    description,
    checked,
    disabled,
    onChange,
}: ArchiveOptionProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <Label
                htmlFor={id}
                className="flex min-w-0 cursor-pointer flex-col gap-0.5 data-disabled:cursor-not-allowed data-disabled:opacity-50"
                data-disabled={disabled ? '' : undefined}
            >
                <span className="text-sm">{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{description}</span>
            </Label>
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                className="mt-0.5 shrink-0"
            />
        </div>
    )
}

function sanitizeFilename(value: string) {
    const sanitized = value
        .replace(/[\\/:*?"<>|]/g, '-')
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()
        .replace(/^[.\s-]+|[.\s-]+$/g, '')

    return sanitized || 'asset'
}

import type { Project, ProjectArchiveExportBody, ProjectExportBody } from '@nai-factory/shared'
import {
    DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS,
    DEFAULT_PROJECT_SETTINGS,
} from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Archive, CircleHelp, Download, FolderDown, Server, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, imageUrl, type SceneSummary } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

type DirectoryPicker = () => Promise<{
    getFileHandle: (
        name: string,
        options?: { create?: boolean },
    ) => Promise<{
        createWritable: () => Promise<{
            write: (data: Blob) => Promise<void>
            close: () => Promise<void>
        }>
    }>
}>

interface ExportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: Project | null
    scenes: SceneSummary[]
}

type ExportMethod = 'zip' | 'directory' | 'server'
type ArchiveMethod = 'archive' | 'import'
type PendingMethod = ExportMethod | ArchiveMethod

export function ExportDialog({ open, onOpenChange, project, scenes }: ExportDialogProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const projectId = project?.id ?? null
    const [template, setTemplate] = useState(DEFAULT_PROJECT_SETTINGS.outputTemplate)
    const [previewTemplate, setPreviewTemplate] = useState(DEFAULT_PROJECT_SETTINGS.outputTemplate)
    const [imageCount, setImageCount] = useState(1)
    const [archiveInclude, setArchiveInclude] = useState(DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [pendingMethod, setPendingMethod] = useState<PendingMethod | null>(null)
    const [message, setMessage] = useState('')

    const saveTemplate = useRef(
        debounce(async (projectId: number, outputTemplate: string) => {
            const { data } = await api.projects({ projectId }).patch({
                settings: { outputTemplate },
            })
            if (data) queryClient.setQueryData(qk.project(projectId), data)
        }, 350),
    )
    const updatePreviewTemplate = useRef(
        debounce((value: string) => {
            setPreviewTemplate(value)
        }, 120),
    )

    useEffect(() => {
        if (!project) return
        saveTemplate.current.cancel()
        updatePreviewTemplate.current.cancel()
        const outputTemplate =
            project.settings.outputTemplate ?? DEFAULT_PROJECT_SETTINGS.outputTemplate
        setTemplate(outputTemplate)
        setPreviewTemplate(outputTemplate)
        setArchiveInclude(DEFAULT_PROJECT_ARCHIVE_INCLUDE_OPTIONS)
        setImportFile(null)
        setMessage('')
    }, [project])

    useEffect(() => {
        return () => {
            saveTemplate.current.flush()
            updatePreviewTemplate.current.flush()
        }
    }, [])

    function exportBody(): ProjectExportBody {
        return {
            imageCount,
            outputTemplate: template.trim(),
        }
    }

    function archiveBody(): ProjectArchiveExportBody {
        return { include: archiveInclude }
    }

    function updateArchiveInclude(key: keyof typeof archiveInclude, checked: boolean) {
        setArchiveInclude((current) => ({ ...current, [key]: checked }))
    }

    function updateTemplate(value: string) {
        setTemplate(value)
        updatePreviewTemplate.current(value)
        if (projectId && value.trim()) saveTemplate.current(projectId, value.trim())
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
        onOpenChange(false)
        navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
    }

    async function exportZip() {
        if (!project || !template.trim()) return
        const { data, error } = await api
            .projects({ projectId: project.id })
            .export.zip.post(exportBody())
        if (error || !data) throw new Error('ZIP export failed')

        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = `${project.name}-export.zip`
        link.click()
        URL.revokeObjectURL(url)
    }

    async function exportDirectory() {
        if (!project || !template.trim()) return

        const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker })
            .showDirectoryPicker
        if (!picker) throw new Error('File System Access API is not available')

        const directory = await picker()
        const { data, error } = await api
            .projects({ projectId: project.id })
            .export.files.post(exportBody())
        if (error || !data) throw new Error('Export file list failed')

        for (const asset of data.assets) {
            const response = await fetch(imageUrl(asset.filePath))
            if (!response.ok) throw new Error(`Failed to fetch ${asset.filename}`)

            const handle = await directory.getFileHandle(asset.filename, { create: true })
            const writable = await handle.createWritable()
            await writable.write(await response.blob())
            await writable.close()
        }
    }

    async function exportServer() {
        if (!project || !template.trim()) return
        const { error } = await api
            .projects({ projectId: project.id })
            .export.server.post(exportBody())
        if (error) throw new Error('Server export failed')
    }

    async function run(method: PendingMethod) {
        setPendingMethod(method)
        setMessage('')

        try {
            if (method === 'archive') await exportProjectArchive()
            else if (method === 'import') await importProjectArchive()
            else if (method === 'zip') await exportZip()
            else if (method === 'directory') await exportDirectory()
            else await exportServer()

            setMessage(method === 'import' ? 'Import 완료' : 'Export 완료')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '작업 실패')
        } finally {
            setPendingMethod(null)
        }
    }

    const disabled = !project || !template.trim() || pendingMethod !== null
    const archiveDisabled = !project || pendingMethod !== null
    const importDisabled = !importFile || pendingMethod !== null
    const preview = renderPreviewFilename(project, scenes, previewTemplate)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4 overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Export</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
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

                        <div className="grid gap-3 rounded-md border p-3">
                            <ArchiveOption
                                id="archive-project-prompt"
                                label="프롬프트"
                                description="프로젝트 프롬프트와 네거티브 프롬프트"
                                checked={archiveInclude.projectPrompt}
                                onChange={(checked) =>
                                    updateArchiveInclude('projectPrompt', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-character-prompts"
                                label="캐릭터 프롬프트"
                                description="NAI character prompt 설정"
                                checked={archiveInclude.characterPrompts}
                                onChange={(checked) =>
                                    updateArchiveInclude('characterPrompts', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-project-variables"
                                label="변수"
                                description="프로젝트 변수"
                                checked={archiveInclude.projectVariables}
                                onChange={(checked) =>
                                    updateArchiveInclude('projectVariables', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-project-parameters"
                                label="파라미터"
                                description="모델, 해상도, 샘플러 등 생성 설정"
                                checked={archiveInclude.projectParameters}
                                onChange={(checked) =>
                                    updateArchiveInclude('projectParameters', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-project-settings"
                                label="프로젝트 설정"
                                description="카드 크기, 출력 템플릿 등 UI/출력 설정"
                                checked={archiveInclude.projectSettings}
                                onChange={(checked) =>
                                    updateArchiveInclude('projectSettings', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-scenes"
                                label="씬"
                                description="씬 이름과 정렬 순서"
                                checked={archiveInclude.scenes}
                                onChange={(checked) => updateArchiveInclude('scenes', checked)}
                            />
                            <ArchiveOption
                                id="archive-scene-variations"
                                label="씬 변수"
                                description="씬별 variation 변수"
                                checked={archiveInclude.sceneVariations}
                                disabled={!archiveInclude.scenes}
                                onChange={(checked) =>
                                    updateArchiveInclude('sceneVariations', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-character-references"
                                label="레퍼런스"
                                description="캐릭터 레퍼런스 이미지와 강도 설정"
                                checked={archiveInclude.characterReferences}
                                onChange={(checked) =>
                                    updateArchiveInclude('characterReferences', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-vibe-transfers"
                                label="바이브"
                                description="Vibe Transfer 이미지와 강도 설정"
                                checked={archiveInclude.vibeTransfers}
                                onChange={(checked) =>
                                    updateArchiveInclude('vibeTransfers', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-images"
                                label="이미지"
                                description="씬에 저장된 생성 이미지 원본"
                                checked={archiveInclude.images}
                                disabled={!archiveInclude.scenes}
                                onChange={(checked) => updateArchiveInclude('images', checked)}
                            />
                            <ArchiveOption
                                id="archive-image-metadata"
                                label="이미지 메타데이터"
                                description="이미지별 생성 메타데이터"
                                checked={archiveInclude.imageMetadata}
                                disabled={!archiveInclude.images}
                                onChange={(checked) =>
                                    updateArchiveInclude('imageMetadata', checked)
                                }
                            />
                            <ArchiveOption
                                id="archive-thumbnails"
                                label="썸네일"
                                description="이미지/레퍼런스 썸네일 파일"
                                checked={archiveInclude.thumbnails}
                                onChange={(checked) => updateArchiveInclude('thumbnails', checked)}
                            />
                            <ArchiveOption
                                id="archive-derived-caches"
                                label="가공 데이터"
                                description="처리된 레퍼런스, 인코딩된 vibe 데이터"
                                checked={archiveInclude.derivedCaches}
                                onChange={(checked) =>
                                    updateArchiveInclude('derivedCaches', checked)
                                }
                            />
                        </div>
                    </section>

                    <div className="border-t" />

                    <section className="flex flex-col gap-4">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-sm font-medium">Output Images</h3>
                            <p className="text-xs text-muted-foreground">
                                생성된 이미지만 별도 파일로 export
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="output-template">템플릿</Label>
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <button
                                                type="button"
                                                className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                                                aria-label="템플릿 사용법"
                                            />
                                        }
                                    >
                                        <CircleHelp className="h-3.5 w-3.5" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" align="start" className="max-w-64">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium">템플릿 토큰</span>
                                            <span>{'{character}'}: 프로젝트명</span>
                                            <span>{'{scene}'}: 씬명</span>
                                            <span>{'{number}'}: 씬별 순번</span>
                                            <span>{'{extension}'}: 원본 확장자</span>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <Input
                                id="output-template"
                                value={template}
                                onChange={(event) => updateTemplate(event.target.value)}
                                className="font-mono text-xs"
                            />
                            <p className="truncate text-[11px] text-muted-foreground">
                                예상 출력: <span className="font-mono">{preview}</span>
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="export-count">상위 N개</Label>
                            <Input
                                id="export-count"
                                type="number"
                                min={1}
                                max={500}
                                value={imageCount}
                                onChange={(event) =>
                                    setImageCount(
                                        Math.min(500, Math.max(1, Number(event.target.value) || 1)),
                                    )
                                }
                                className="w-28"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                className="justify-start gap-2"
                                disabled={disabled}
                                onClick={() => run('zip')}
                            >
                                <Archive className="h-4 w-4" />
                                {pendingMethod === 'zip' ? 'ZIP 생성 중...' : 'ZIP 다운로드'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="justify-start gap-2"
                                disabled={disabled}
                                onClick={() => run('directory')}
                            >
                                <FolderDown className="h-4 w-4" />
                                {pendingMethod === 'directory' ? '저장 중...' : '폴더에 바로 저장'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="justify-start gap-2"
                                disabled={disabled}
                                onClick={() => run('server')}
                            >
                                <Server className="h-4 w-4" />
                                {pendingMethod === 'server' ? '복사 중...' : '서버 경로로 복사'}
                            </Button>
                        </div>
                    </section>

                    {message && <p className="text-xs text-muted-foreground">{message}</p>}
                </div>
            </DialogContent>
        </Dialog>
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

function renderPreviewFilename(project: Project | null, scenes: SceneSummary[], template: string) {
    const scene = scenes[0] ?? null
    const image = scene?.latestImages?.[0] ?? null
    const extension = image ? fileExtension(image.filePath) : 'png'

    return renderOutputTemplate(template.trim() || DEFAULT_PROJECT_SETTINGS.outputTemplate, {
        character: project?.name ?? 'character',
        scene: scene?.name ?? 'scene',
        number: 1,
        extension,
    })
}

function fileExtension(filePath: string) {
    const extension = filePath.split('.').pop()?.trim()
    return extension || 'png'
}

function renderOutputTemplate(
    template: string,
    values: { character: string; scene: string; number: number; extension: string },
) {
    const rendered = template
        .replaceAll('{character}', values.character)
        .replaceAll('{scene}', values.scene)
        .replaceAll('{number}', String(values.number))
        .replaceAll('{extension}', values.extension)

    const sanitized = sanitizeFilename(rendered)
    if (/\.[^./\\]+$/.test(sanitized)) return sanitized

    return `${sanitized}.${values.extension}`
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

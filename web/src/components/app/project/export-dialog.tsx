import type { Project, ProjectExportBody } from '@nai-factory/shared'
import { DEFAULT_PROJECT_SETTINGS } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, CircleHelp, FolderDown, Server } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function ExportDialog({ open, onOpenChange, project, scenes }: ExportDialogProps) {
    const queryClient = useQueryClient()
    const projectId = project?.id ?? null
    const [template, setTemplate] = useState(DEFAULT_PROJECT_SETTINGS.outputTemplate)
    const [previewTemplate, setPreviewTemplate] = useState(DEFAULT_PROJECT_SETTINGS.outputTemplate)
    const [imageCount, setImageCount] = useState(1)
    const [pendingMethod, setPendingMethod] = useState<ExportMethod | null>(null)
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

    function updateTemplate(value: string) {
        setTemplate(value)
        updatePreviewTemplate.current(value)
        if (projectId && value.trim()) saveTemplate.current(projectId, value.trim())
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

    async function run(method: ExportMethod) {
        setPendingMethod(method)
        setMessage('')

        try {
            if (method === 'zip') await exportZip()
            else if (method === 'directory') await exportDirectory()
            else await exportServer()

            setMessage('Export 완료')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Export 실패')
        } finally {
            setPendingMethod(null)
        }
    }

    const disabled = !project || !template.trim() || pendingMethod !== null
    const preview = renderPreviewFilename(project, scenes, previewTemplate)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-w-md flex-col gap-4">
                <DialogHeader>
                    <DialogTitle>Output Export</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
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

                    {message && <p className="text-xs text-muted-foreground">{message}</p>}
                </div>
            </DialogContent>
        </Dialog>
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

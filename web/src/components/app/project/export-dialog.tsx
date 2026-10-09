import type {
    Project,
    ProjectExportBody,
    ProjectSettings,
    ProjectSettingsPatch,
    SceneSummary,
} from '@nai-factory/shared'
import { DEFAULT_PROJECT_SETTINGS } from '@nai-factory/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, CircleHelp, FolderDown, Server } from 'lucide-react'
import { useCallback, useDeferredValue, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAutosave } from '@/hooks/use-autosave'
import { assetUrl, call, contract, errorMessage } from '@/lib/api'
import { qk, queries } from '@/lib/queries'
import { cn } from '@/lib/utils'

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

interface OutputImagesSettingsProps {
    project: Project | null
    scenes: SceneSummary[]
}

interface ExportDialogProps extends OutputImagesSettingsProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

type ExportMethod = 'zip' | 'directory' | 'server'

export function ExportDialog({ open, onOpenChange, project, scenes }: ExportDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-4 overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Output Images</DialogTitle>
                </DialogHeader>
                <OutputImagesSettings project={project} scenes={scenes} />
            </DialogContent>
        </Dialog>
    )
}

function OutputImagesSettings({ project, scenes }: OutputImagesSettingsProps) {
    const queryClient = useQueryClient()
    const projectId = project?.id ?? null
    const [imageCount, setImageCount] = useState(1)
    const [pendingMethod, setPendingMethod] = useState<ExportMethod | null>(null)
    const [message, setMessage] = useState('')
    const [serverFolder, setServerFolder] = useState('')
    const settingsQuery = useQuery(queries.settings.get())
    const serverExportEnabled = settingsQuery.data?.export.serverExportEnabled ?? false
    const sourceExtension = settingsQuery.data?.image.sourceType.type ?? 'png'

    const saveTemplate = useCallback(
        async (patch: ProjectSettingsPatch) => {
            if (projectId === null) return
            const data = await call(contract.projects.update, {
                params: { id: projectId },
                body: { settings: { ...patch, outputTemplate: patch.outputTemplate?.trim() } },
            })
            queryClient.setQueryData(qk.projects.get(projectId), data)
        },
        [projectId, queryClient],
    )
    const settingsDraft = useAutosave<ProjectSettings, ProjectSettingsPatch>({
        data: project?.settings,
        save: saveTemplate,
        delay: 350,
    })
    // A blank template is never saved; it stays here until something is typed.
    const [blankTemplate, setBlankTemplate] = useState<string | null>(null)
    const template =
        blankTemplate ??
        settingsDraft.value?.outputTemplate ??
        DEFAULT_PROJECT_SETTINGS.outputTemplate
    const previewTemplate = useDeferredValue(template)

    function exportBody(): ProjectExportBody {
        return {
            imageCount,
            outputTemplate: template.trim(),
        }
    }

    function updateTemplate(value: string) {
        if (!value.trim()) {
            setBlankTemplate(value)
            return
        }
        setBlankTemplate(null)
        settingsDraft.update({ outputTemplate: value })
    }

    async function exportZip() {
        if (!project || !template.trim()) return
        const data = await call(contract.projects.exportZip, {
            params: { id: project.id },
            body: exportBody(),
        })

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
        const data = await call(contract.projects.exportFiles, {
            params: { id: project.id },
            body: exportBody(),
        })

        for (const asset of data.assets) {
            const response = await fetch(assetUrl(asset.assetId))
            if (!response.ok) throw new Error(`Failed to fetch ${asset.filename}`)

            const handle = await directory.getFileHandle(asset.filename, { create: true })
            const writable = await handle.createWritable()
            await writable.write(await response.blob())
            await writable.close()
        }
    }

    async function exportServer() {
        if (!project || !template.trim()) return
        const result = await call(contract.projects.exportServer, {
            params: { id: project.id },
            body: { ...exportBody(), folder: serverFolder.trim() },
        })
        return result.exported
    }

    async function run(method: ExportMethod) {
        setPendingMethod(method)
        setMessage('')

        try {
            if (method === 'zip') await exportZip()
            else if (method === 'directory') await exportDirectory()
            else {
                const exported = await exportServer()
                setMessage(`서버의 ${serverFolder.trim()} 폴더에 ${exported}개를 저장했습니다`)
                return
            }

            setMessage('Export 완료')
        } catch (error) {
            setMessage(errorMessage(error, '작업 실패'))
        } finally {
            setPendingMethod(null)
        }
    }

    const disabled = !project || !template.trim() || pendingMethod !== null
    const preview = renderPreviewFilename(project, scenes, previewTemplate, sourceExtension)

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="output-template">템플릿</Label>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <button
                                    type="button"
                                    className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
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
                    className="font-mono"
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
                        setImageCount(Math.min(500, Math.max(1, Number(event.target.value) || 1)))
                    }
                    className="w-28"
                />
            </div>

            {serverExportEnabled && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="server-export-folder">서버 폴더 이름</Label>
                    <Input
                        id="server-export-folder"
                        value={serverFolder}
                        onChange={(event) => setServerFolder(event.target.value)}
                        placeholder="예: my-project"
                        className="font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                        서버 export 폴더 아래에 만들어집니다. 영문, 숫자, 공백, -, _, . 만 사용할 수
                        있습니다.
                    </p>
                </div>
            )}

            <div
                className={cn(
                    'grid gap-2',
                    serverExportEnabled ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
                )}
            >
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
                    {pendingMethod === 'directory' ? '저장 중...' : '폴더에 저장'}
                </Button>
                {serverExportEnabled && (
                    <Button
                        type="button"
                        variant="outline"
                        className="justify-start gap-2"
                        disabled={disabled || !serverFolder.trim()}
                        onClick={() => run('server')}
                    >
                        <Server className="h-4 w-4" />
                        {pendingMethod === 'server' ? '복사 중...' : '서버로 복사'}
                    </Button>
                )}
            </div>

            {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
    )
}

function renderPreviewFilename(
    project: Project | null,
    scenes: SceneSummary[],
    template: string,
    extension: string,
) {
    const scene = scenes[0] ?? null

    return renderOutputTemplate(template.trim() || DEFAULT_PROJECT_SETTINGS.outputTemplate, {
        character: project?.name ?? 'character',
        scene: scene?.name ?? 'scene',
        number: 1,
        extension,
    })
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

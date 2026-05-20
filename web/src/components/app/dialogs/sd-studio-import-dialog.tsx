import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FileJson } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'
import { cn } from '#/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'choose' | 'options' | 'project-name'

interface ImportOptions {
    importPrompt: boolean
    importNegativePrompt: boolean
    importScenes: boolean
    importCharacterPrompts: boolean
    importParameters: boolean
}

interface ParsedFile {
    raw: unknown
    name: string
    sceneCount: number
    hasPreset: boolean
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    file: File | null
    /** null when dropped outside a project page */
    projectId: number | null
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SdStudioImportDialog({ open, onOpenChange, file, projectId }: Props) {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const [step, setStep] = useState<Step>('choose')
    const [parsed, setParsed] = useState<ParsedFile | null>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [projectName, setProjectName] = useState('')
    const [options, setOptions] = useState<ImportOptions>({
        importPrompt: true,
        importNegativePrompt: true,
        importScenes: true,
        importCharacterPrompts: true,
        importParameters: true,
    })

    // Parse the file whenever it changes
    useEffect(() => {
        if (!file) return

        setParsed(null)
        setParseError(null)
        setStep(projectId ? 'choose' : 'project-name')

        file.text().then((text) => {
            try {
                const raw = JSON.parse(text) as Record<string, unknown>
                const name =
                    typeof raw.name === 'string' ? raw.name : file.name.replace(/\.json$/, '')
                const scenesObj = raw.scenes as Record<string, unknown> | undefined
                const sceneCount = scenesObj ? Object.keys(scenesObj).length : 0
                const hasPreset = !!raw.selectedWorkflow && !!raw.presets

                setParsed({ raw, name, sceneCount, hasPreset })
                setProjectName(name)
            } catch {
                setParseError('JSON 파일을 파싱할 수 없습니다.')
            }
        })
    }, [file, projectId])

    // ─── Mutations ────────────────────────────────────────────────────────────

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!parsed || !projectId) throw new Error('Invalid state')
            const { error } = await api['sd-studio'].import.post({
                projectId,
                data: parsed.raw,
                options,
            })
            if (error) throw new Error(String(error.value))
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.scenes(projectId as number) })
            onOpenChange(false)
        },
    })

    const createAndImportMutation = useMutation({
        mutationFn: async () => {
            if (!parsed || !projectName.trim()) throw new Error('Invalid state')

            const { data: project, error: createError } = await api.projects.post({
                groupId: null,
                name: projectName.trim(),
            })
            if (createError || !project) throw new Error('프로젝트 생성 실패')

            const { error: importError } = await api['sd-studio'].import.post({
                projectId: project.id,
                data: parsed.raw,
                options: {
                    importPrompt: true,
                    importNegativePrompt: true,
                    importScenes: true,
                    importCharacterPrompts: true,
                    importParameters: true,
                },
            })
            if (importError) throw new Error('가져오기 실패')

            return project.id
        },
        onSuccess: (newProjectId) => {
            queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
            navigate({ to: '/project/$projectId', params: { projectId: String(newProjectId) } })
            onOpenChange(false)
        },
    })

    // ─── Helpers ──────────────────────────────────────────────────────────────

    const isLoading = importMutation.isPending || createAndImportMutation.isPending

    function toggleOption(key: keyof ImportOptions) {
        setOptions((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    function handleClose() {
        if (isLoading) return
        onOpenChange(false)
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                {/* Error state */}
                {parseError && (
                    <>
                        <DialogHeader>
                            <DialogTitle>파일 오류</DialogTitle>
                            <DialogDescription>{parseError}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => onOpenChange(false)}>닫기</Button>
                        </DialogFooter>
                    </>
                )}

                {/* Loading state */}
                {!parseError && !parsed && (
                    <DialogHeader>
                        <DialogTitle>파일 읽는 중...</DialogTitle>
                    </DialogHeader>
                )}

                {/* Step: choose mode (inside project) */}
                {!parseError && parsed && step === 'choose' && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileJson className="size-4" />
                                SD Studio 가져오기
                            </DialogTitle>
                            <DialogDescription>
                                <span className="font-medium text-foreground">{parsed.name}</span>
                                {' — 씬 '}
                                <span className="font-medium text-foreground">
                                    {parsed.sceneCount}개
                                </span>{' '}
                                발견
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 py-1">
                            <Button
                                variant="outline"
                                className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
                                onClick={() => setStep('options')}
                            >
                                <span className="font-medium">현재 프로젝트에 가져오기</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    씬을 현재 프로젝트에 추가합니다. 가져올 항목을 선택할 수
                                    있습니다.
                                </span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-auto flex-col items-start gap-1 px-4 py-3 text-left"
                                onClick={() => setStep('project-name')}
                            >
                                <span className="font-medium">새 프로젝트로 가져오기</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                    새 프로젝트를 생성하고 모든 항목을 가져옵니다.
                                </span>
                            </Button>
                        </div>
                    </>
                )}

                {/* Step: choose import options (current project) */}
                {!parseError && parsed && step === 'options' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>가져올 항목 선택</DialogTitle>
                            <DialogDescription>
                                {!parsed.hasPreset && (
                                    <span className="block text-yellow-500">
                                        ⚠ 프리셋 정보가 없습니다. 씬만 가져올 수 있습니다.
                                    </span>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3 py-1">
                            <OptionRow
                                id="importPrompt"
                                label="프롬프트"
                                description="frontPrompt + [[prompt]] + backPrompt 형태로 프로젝트 프롬프트 설정"
                                checked={options.importPrompt}
                                disabled={!parsed.hasPreset}
                                onChange={() => toggleOption('importPrompt')}
                            />
                            <OptionRow
                                id="importNegativePrompt"
                                label="부정 프롬프트"
                                description="프리셋의 UC를 프로젝트 부정 프롬프트로 설정"
                                checked={options.importNegativePrompt}
                                disabled={!parsed.hasPreset}
                                onChange={() => toggleOption('importNegativePrompt')}
                            />
                            <OptionRow
                                id="importScenes"
                                label="씬"
                                description="SD Studio 씬을 현재 프로젝트에 추가"
                                checked={options.importScenes}
                                onChange={() => toggleOption('importScenes')}
                            />
                            <OptionRow
                                id="importCharacterPrompts"
                                label="캐릭터 프롬프트"
                                description="프리셋의 캐릭터 프롬프트 목록 가져오기"
                                checked={options.importCharacterPrompts}
                                disabled={!parsed.hasPreset}
                                onChange={() => toggleOption('importCharacterPrompts')}
                            />
                            <OptionRow
                                id="importParameters"
                                label="파라미터"
                                description="steps, sampler, CFG 등 생성 파라미터 가져오기"
                                checked={options.importParameters}
                                disabled={!parsed.hasPreset}
                                onChange={() => toggleOption('importParameters')}
                            />
                        </div>
                        {importMutation.isError && (
                            <p className="text-sm text-destructive">
                                가져오기에 실패했습니다. 다시 시도해주세요.
                            </p>
                        )}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setStep('choose')}
                                disabled={isLoading}
                            >
                                <ArrowLeft className="mr-1 size-4" />
                                뒤로
                            </Button>
                            <Button onClick={() => importMutation.mutate()} disabled={isLoading}>
                                {isLoading ? '가져오는 중...' : '가져오기'}
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {/* Step: new project name */}
                {!parseError && parsed && step === 'project-name' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>새 프로젝트로 가져오기</DialogTitle>
                            <DialogDescription>
                                씬 {parsed.sceneCount}개와 모든 설정을 새 프로젝트로 가져옵니다.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                if (!projectName.trim()) return
                                createAndImportMutation.mutate()
                            }}
                            className="flex flex-col gap-4 py-1"
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="sd-project-name">프로젝트 이름</Label>
                                <Input
                                    id="sd-project-name"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="프로젝트 이름..."
                                    autoFocus
                                />
                            </div>
                            {createAndImportMutation.isError && (
                                <p className="text-sm text-destructive">
                                    가져오기에 실패했습니다. 다시 시도해주세요.
                                </p>
                            )}
                            <DialogFooter>
                                {projectId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStep('choose')}
                                        disabled={isLoading}
                                    >
                                        <ArrowLeft className="mr-1 size-4" />
                                        뒤로
                                    </Button>
                                )}
                                <Button type="submit" disabled={!projectName.trim() || isLoading}>
                                    {isLoading ? '가져오는 중...' : '가져오기'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ─── OptionRow ────────────────────────────────────────────────────────────────

interface OptionRowProps {
    id: string
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: () => void
}

function OptionRow({ id, label, description, checked, disabled, onChange }: OptionRowProps) {
    return (
        <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-40')}>
            <Label htmlFor={id} className="flex cursor-pointer flex-col gap-0.5">
                <span>{label}</span>
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

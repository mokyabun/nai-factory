import { NOVEL_AI_MODEL_OPTIONS, NOVEL_AI_SAMPLER_OPTIONS } from '@nai-factory/shared'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ImageDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { GenerationSettings, SettingsSelection } from '@/features/images/generation-settings'
import { useApplyGenerationSettings } from '@/features/images/use-apply-generation-settings'
import { errorMessage } from '@/lib/api'
import { queries } from '@/lib/queries'
import { cn } from '@/lib/utils'

import type { ImageSettings } from './read-image-settings'

export type ImportTarget = 'playground' | 'project'

type Field = 'prompt' | 'negativePrompt' | 'characterPrompts' | 'parameters' | 'seed'

type PromptMode = SettingsSelection['promptMode']

interface ImageSettingsImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fileName: string
    imported: ImageSettings | null
    projectId: number | null
    defaultTarget: ImportTarget
}

const ORIGIN_LABELS: Record<ImageSettings['origin'], string> = {
    novelai: 'NovelAI',
    'nai-factory': 'NAI Factory',
}

const PROMPT_MODES: Array<{ value: PromptMode; label: string }> = [
    { value: 'replace', label: '교체' },
    { value: 'append', label: '뒤에 추가' },
]

function availableFields(settings: GenerationSettings): Record<Field, boolean> {
    return {
        prompt: settings.prompt !== null,
        negativePrompt: settings.negativePrompt !== null,
        characterPrompts: settings.characterPrompts !== null,
        parameters: Object.keys(settings.parameters).length > 0,
        seed: settings.seed !== null,
    }
}

function parametersSummary({ parameters }: GenerationSettings) {
    const model = NOVEL_AI_MODEL_OPTIONS.find((option) => option.value === parameters.model)
    const sampler = NOVEL_AI_SAMPLER_OPTIONS.find((option) => option.value === parameters.sampler)
    return [
        model?.label,
        parameters.width && parameters.height && `${parameters.width}×${parameters.height}`,
        parameters.steps !== undefined && `스텝 ${parameters.steps}`,
        parameters.promptGuidance !== undefined && `CFG ${parameters.promptGuidance}`,
        sampler?.label,
    ]
        .filter(Boolean)
        .join(' · ')
}

function fieldDescriptions(settings: GenerationSettings): Record<Field, string> {
    const characterCount = settings.characterPrompts?.length ?? 0
    return {
        prompt: settings.prompt || '(비어 있음)',
        negativePrompt: settings.negativePrompt || '(비어 있음)',
        characterPrompts:
            characterCount > 0 ? `${characterCount}개로 교체` : '없음 (기존 캐릭터를 비웁니다)',
        parameters: parametersSummary(settings) || '기록 없음',
        seed: settings.seed === null ? '기록 없음' : String(settings.seed),
    }
}

const FIELD_LABELS: Record<Field, string> = {
    prompt: '프롬프트',
    negativePrompt: '부정 프롬프트',
    characterPrompts: '캐릭터 프롬프트',
    parameters: '파라미터',
    seed: '시드',
}

export function ImageSettingsImportDialog({
    open,
    onOpenChange,
    fileName,
    imported,
    projectId,
    defaultTarget,
}: ImageSettingsImportDialogProps) {
    const navigate = useNavigate()
    const { toPlayground, toProject } = useApplyGenerationSettings()
    const projectQuery = useQuery({
        ...queries.projects.get(projectId ?? 0),
        enabled: open && projectId !== null,
    })
    const [target, setTarget] = useState<ImportTarget>(defaultTarget)
    const [fields, setFields] = useState<Record<Field, boolean> | null>(null)
    const [promptMode, setPromptMode] = useState<PromptMode>('replace')

    // Every opening starts from the defaults for the dropped image.
    const [openedWith, setOpenedWith] = useState<ImageSettings | null>(null)
    if (open && imported && imported !== openedWith) {
        setOpenedWith(imported)
        setTarget(projectId === null ? 'playground' : defaultTarget)
        setFields({ ...availableFields(imported.settings), seed: false })
        setPromptMode('replace')
    }

    if (!imported || !fields) return null

    const settings = imported.settings
    const available = availableFields(settings)
    const descriptions = fieldDescriptions(settings)
    const isPending = toPlayground.isPending || toProject.isPending
    const hasSelection = Object.values(fields).some(Boolean)
    const changesPrompts = fields.prompt || fields.negativePrompt

    function toggle(field: Field) {
        setFields((current) => current && { ...current, [field]: !current[field] })
    }

    function handleOpenChange(nextOpen: boolean) {
        if (isPending) return
        onOpenChange(nextOpen)
    }

    async function apply() {
        if (!fields) return
        const selection: SettingsSelection = {
            prompt: fields.prompt,
            negativePrompt: fields.negativePrompt,
            characterPrompts: fields.characterPrompts,
            parameters: fields.parameters,
            seed: fields.seed ? 'image' : 'keep',
            promptMode,
        }

        try {
            if (target === 'project' && projectId !== null) {
                await toProject.mutateAsync({ projectId, settings, selection })
                toast.success('프로젝트에 적용했습니다')
            } else {
                await toPlayground.mutateAsync({ settings, selection })
                toast.success('Playground에 불러왔습니다')
                void navigate({ to: '/playground' })
            }
            onOpenChange(false)
        } catch (error) {
            toast.error(errorMessage(error, '적용하지 못했습니다'))
        }
    }

    const targets: Array<{ value: ImportTarget; label: string; description: string }> = [
        { value: 'playground', label: 'Playground', description: 'Playground 설정을 바꿉니다.' },
        {
            value: 'project',
            label: '프로젝트',
            description: projectQuery.data?.name ?? '현재 프로젝트의 공통 설정을 바꿉니다.',
        },
    ]

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ImageDown className="size-4" />
                        이미지 설정 가져오기
                    </DialogTitle>
                    <DialogDescription className="break-all">
                        {fileName} · {ORIGIN_LABELS[imported.origin]} 메타데이터
                    </DialogDescription>
                </DialogHeader>

                {projectId !== null && (
                    <div className="grid grid-cols-2 gap-2">
                        {targets.map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                variant="outline"
                                className={cn(
                                    'h-auto flex-col items-start gap-1 px-3 py-2 text-left',
                                    target === option.value && 'border-primary bg-primary/5',
                                )}
                                onClick={() => setTarget(option.value)}
                                disabled={isPending}
                            >
                                <span className="font-medium">{option.label}</span>
                                <span className="w-full truncate text-xs font-normal text-muted-foreground">
                                    {option.description}
                                </span>
                            </Button>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {(Object.keys(FIELD_LABELS) as Field[]).map((field) => (
                        <div
                            key={field}
                            className={cn(
                                'flex items-start justify-between gap-4',
                                !available[field] && 'opacity-40',
                            )}
                        >
                            <Label
                                htmlFor={`image-import-${field}`}
                                className="min-w-0 cursor-pointer flex-col items-start gap-1"
                            >
                                <span>{FIELD_LABELS[field]}</span>
                                <span className="line-clamp-2 text-xs leading-snug font-normal break-all text-muted-foreground">
                                    {descriptions[field]}
                                </span>
                            </Label>
                            <Switch
                                id={`image-import-${field}`}
                                checked={fields[field] && available[field]}
                                onCheckedChange={() => toggle(field)}
                                disabled={!available[field] || isPending}
                                className="mt-0.5 shrink-0"
                            />
                        </div>
                    ))}
                </div>

                {changesPrompts && (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-sm">프롬프트 적용 방식</span>
                        <div className="grid grid-cols-2 gap-1">
                            {PROMPT_MODES.map((mode) => (
                                <Button
                                    key={mode.value}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                        promptMode === mode.value && 'border-primary bg-primary/5',
                                    )}
                                    onClick={() => setPromptMode(mode.value)}
                                    disabled={isPending}
                                >
                                    {mode.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {imported.unsupported.length > 0 && (
                    <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs">
                        <p className="font-medium">적용되지 않는 항목</p>
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                            {imported.unsupported.map((item) => (
                                <li key={item} className="break-all">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
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
                        onClick={() => void apply()}
                        disabled={!hasSelection || isPending}
                    >
                        {isPending ? '적용 중...' : '적용'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

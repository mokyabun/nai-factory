import type { ScenePatchBody, ScenePreviewResult, SceneVariationDraft } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { VariationEditor } from '@/components/app/project/variation-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { normalizeVariableDraft, variableValidationMessage } from '@/lib/prompt-variables'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

export const Route = createFileRoute('/scene/$sceneId/')({ component: SceneEditPage })

function SceneEditPage() {
    const { sceneId } = Route.useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const scenId = Number(sceneId)

    const sceneQuery = useQuery({
        queryKey: qk.scene(scenId),
        queryFn: async () => {
            const { data } = await api.scenes({ id: scenId }).get()
            return data ?? null
        },
    })

    const previewQuery = useQuery({
        queryKey: ['scene', scenId, 'preview-prompt'],
        queryFn: async () => {
            const { data } = await api.scenes({ id: scenId })['preview-prompt'].get()
            return data ?? null
        },
        enabled: !!sceneQuery.data,
    })

    const [name, setName] = useState('')
    const [variations, setVariations] = useState<SceneVariationDraft[]>([])
    const [loadedId, setLoadedId] = useState<number | null>(null)

    // Sync local state only when switching to a different scene
    useEffect(() => {
        const data = sceneQuery.data
        if (data && data.id !== loadedId) {
            setLoadedId(data.id)
            setName(data.name)
            setVariations(data.variations ?? [])
        }
    }, [sceneQuery.data, loadedId])

    const patchScene = useMutation({
        mutationFn: (patch: ScenePatchBody) => api.scenes({ id: scenId }).patch(patch),
        onSuccess: (res) => {
            if (res.data) queryClient.setQueryData(qk.scene(scenId), res.data)
            queryClient.invalidateQueries({ queryKey: qk.scenes(sceneQuery.data?.projectId ?? 0) })
            queryClient.invalidateQueries({ queryKey: ['scene', scenId, 'preview-prompt'] })
        },
    })

    const saveName = useRef(debounce((value: string) => patchScene.mutate({ name: value }), 600))
    const saveVariations = useRef(
        debounce((value: SceneVariationDraft[]) => {
            if (variationValidationMessage(value)) return
            patchScene.mutate({
                variations: value.map((variation) => ({
                    ...variation,
                    variables: normalizeVariableDraft(variation.variables),
                })),
            })
        }, 600),
    )

    // Flush debounces on unmount
    useEffect(() => {
        return () => {
            saveName.current.flush()
            saveVariations.current.flush()
        }
    }, [])

    function handleNameChange(value: string) {
        setName(value)
        saveName.current(value)
    }

    function handleVariationsChange(value: SceneVariationDraft[]) {
        setVariations(value)
        saveVariations.current(value)
    }

    if (sceneQuery.isPending) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                불러오는 중...
            </div>
        )
    }

    if (!sceneQuery.data) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                씬을 찾을 수 없습니다.
            </div>
        )
    }

    const projectId = sceneQuery.data.projectId

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                        navigate({
                            to: '/project/$projectId',
                            params: { projectId: String(projectId) },
                        })
                    }
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="h-8 max-w-xs text-sm font-medium"
                    placeholder="씬 이름..."
                />
                <span className="text-xs text-muted-foreground">
                    {patchScene.isPending ? '저장 중...' : `${variations.length}개 변수 세트`}
                </span>
            </div>

            {/* Variations */}
            <div className="flex-1 overflow-auto">
                {variations.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                        <p className="text-sm">변수 세트가 없습니다.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleVariationsChange([{ variables: [] }])}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            변수 세트 추가
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
                        <VariationEditor
                            variations={variations}
                            onChange={handleVariationsChange}
                        />
                        <PromptPreviewPanel
                            validationMessage={variationValidationMessage(variations)}
                            pendingSave={patchScene.isPending}
                            preview={previewQuery.data ?? null}
                            loading={previewQuery.isPending}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

function variationValidationMessage(variations: SceneVariationDraft[]) {
    for (const [index, variation] of variations.entries()) {
        const message = variableValidationMessage(variation.variables)
        if (message) return `Variation ${index + 1}: ${message}`
    }

    return null
}

function PromptPreviewPanel({
    validationMessage,
    pendingSave,
    preview,
    loading,
}: {
    validationMessage: string | null
    pendingSave: boolean
    preview: ScenePreviewResult | null
    loading: boolean
}) {
    return (
        <aside className="flex min-h-0 flex-col gap-3 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Compiled Preview</h2>
                <span className="text-[11px] text-muted-foreground">
                    {pendingSave ? 'Saving...' : 'Saved state'}
                </span>
            </div>

            {validationMessage ? (
                <div className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{validationMessage}</span>
                </div>
            ) : loading ? (
                <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                    Loading preview...
                </div>
            ) : preview?.ok === false ? (
                <div className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{preview.error.message}</span>
                </div>
            ) : preview?.ok === true && preview.prompts.length > 0 ? (
                <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                    {preview.prompts.map((prompt, index) => (
                        <section
                            // biome-ignore lint/suspicious/noArrayIndexKey: preview order follows variation order.
                            key={index}
                            className="rounded border bg-background/40 p-2"
                        >
                            <h3 className="mb-2 text-xs font-medium">Variation {index + 1}</h3>
                            <PreviewBlock label="Prompt" value={prompt.prompt} />
                            <PreviewBlock label="Negative" value={prompt.negativePrompt} />
                            {prompt.characterPrompts.length > 0 && (
                                <PreviewBlock
                                    label="Character Prompts"
                                    value={JSON.stringify(prompt.characterPrompts, null, 2)}
                                />
                            )}
                        </section>
                    ))}
                </div>
            ) : (
                <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                    No compiled prompts.
                </div>
            )}
        </aside>
    )
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="mb-2 last:mb-0">
            <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px] leading-relaxed">
                {value || '-'}
            </pre>
        </div>
    )
}

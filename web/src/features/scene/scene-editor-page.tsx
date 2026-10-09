import type { Scene, ScenePatch, SceneSummary, VariationDraft } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import { StatusMessage } from '@/components/status-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedPatch } from '@/hooks/use-debounced-patch'
import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries, tempId } from '@/lib/optimistic'
import { normalizeVariableDraft, variableValidationMessage } from '@/lib/prompt-variables'
import { matchesKey, qk, queries } from '@/lib/queries'

import { PromptPreviewPanel } from './prompt-preview-panel'
import { VariationEditor } from './variation-editor'

export function SceneEditorPage({ sceneId }: { sceneId: number }) {
    const sceneQuery = useQuery(queries.scenes.get(sceneId))

    if (sceneQuery.isPending) {
        return <StatusMessage className="h-full">불러오는 중...</StatusMessage>
    }

    if (!sceneQuery.data) {
        return <StatusMessage className="h-full">씬을 찾을 수 없습니다.</StatusMessage>
    }

    // Keyed by scene: the draft starts from the loaded scene and later refetches leave it alone.
    return <SceneEditor key={sceneQuery.data.id} scene={sceneQuery.data} />
}

function SceneEditor({ scene: loadedScene }: { scene: Scene }) {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { id: sceneId, projectId } = loadedScene

    const previewQuery = useQuery(queries.scenes.preview(sceneId))

    const [name, setName] = useState(loadedScene.name)
    const [variations, setVariations] = useState<VariationDraft[]>(loadedScene.variations)

    const patchScene = useMutation({
        mutationFn: (patch: ScenePatch) =>
            call(contract.scenes.update, { params: { id: sceneId }, body: patch }),
        onMutate: async (patch) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) =>
                    matchesKey(query.queryKey, qk.scenes.get(sceneId)) ||
                    matchesKey(query.queryKey, qk.scenes.list(projectId)),
            })
            if (patch.name) {
                queryClient.setQueryData<SceneSummary[]>(qk.scenes.list(projectId), (scenes) =>
                    scenes?.map((scene) =>
                        scene.id === sceneId ? { ...scene, name: patch.name as string } : scene,
                    ),
                )
            }
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSuccess: (scene: Scene, patch) => {
            queryClient.setQueryData(qk.scenes.get(sceneId), scene)
            // Server ids replace the temporary negative ids; local ids keep editor rows mounted.
            patch.variations?.forEach((draft, index) => {
                const saved = scene.variations[index]
                if (draft.id !== undefined && draft.id < 0 && saved) {
                    savedIds.current.set(draft.id, saved.id)
                }
            })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.list(scene.projectId) })
            void queryClient.invalidateQueries({ queryKey: qk.scenes.preview(sceneId) })
        },
    })

    const pendingSave = useDebouncedPatch<ScenePatch>((patch) => patchScene.mutate(patch))
    const savedIds = useRef(new Map<number, number>())

    function handleNameChange(value: string) {
        setName(value)
        if (value.trim()) pendingSave.schedule({ name: value })
    }

    function handleVariationsChange(value: VariationDraft[]) {
        setVariations(value)
        if (variationValidationMessage(value)) return
        pendingSave.schedule({
            variations: value.map((variation) => ({
                id:
                    variation.id === undefined
                        ? undefined
                        : (savedIds.current.get(variation.id) ?? variation.id),
                variables: normalizeVariableDraft(variation.variables),
            })),
        })
    }

    return (
        <div className="flex h-full flex-col gap-4">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
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
                    className="max-w-xs text-sm font-medium"
                    placeholder="씬 이름..."
                />
                <span className="text-xs text-muted-foreground">
                    {patchScene.isPending ? '저장 중...' : `${variations.length}개 변수 세트`}
                </span>
            </div>

            <div className="flex-1 overflow-auto">
                {variations.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                        <p className="text-sm">변수 세트가 없습니다.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                                handleVariationsChange([{ id: tempId(), variables: [] }])
                            }
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

function variationValidationMessage(variations: VariationDraft[]) {
    for (const [index, variation] of variations.entries()) {
        const message = variableValidationMessage(variation.variables)
        if (message) return `Variation ${index + 1}: ${message}`
    }

    return null
}

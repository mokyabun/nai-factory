import type { PromptVariation, ScenePatchBody } from '@nai-factory/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { VariationEditor } from '@/components/app/project/variation-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
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

    const [name, setName] = useState('')
    const [variations, setVariations] = useState<PromptVariation[]>([])
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
        },
    })

    const saveName = useRef(debounce((value: string) => patchScene.mutate({ name: value }), 600))
    const saveVariations = useRef(
        debounce((value: PromptVariation[]) => patchScene.mutate({ variations: value }), 600),
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

    function handleVariationsChange(value: PromptVariation[]) {
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
                            onClick={() => handleVariationsChange([{}])}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            변수 세트 추가
                        </Button>
                    </div>
                ) : (
                    <VariationEditor
                        variations={variations}
                        onChange={handleVariationsChange}
                        layout="row"
                    />
                )}
            </div>
        </div>
    )
}

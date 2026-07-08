import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import type {
    Project,
    ProjectSettings,
    ProjectSettingsPatch,
    StashItem,
    StashPostBody,
} from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
    Archive,
    Check,
    Download,
    FileText,
    Layers,
    ListPlus,
    Plus,
    Save,
    Settings,
    SlidersHorizontal,
    Trash2,
    X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateSceneDialog } from '@/components/app/dialogs/create-scene-dialog'
import { ExportDialog } from '@/components/app/project/export-dialog'
import { SortableSceneItem } from '@/components/app/project/sortable-scene-item'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, type SceneSummary } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'
import {
    hasScenesAtom,
    loadedProjectIdAtom,
    projectPageDialogAtom,
    reorderSceneItems,
    sceneCardSizeAtom,
    sceneItemsAtom,
    selectedSceneCountAtom,
    selectedSceneIdsAtom,
    selectedSceneIdsSetAtom,
    selectModeAtom,
    slideshowImageCountAtom,
} from './atom'

export const Route = createFileRoute('/project/$projectId/')({ component: ProjectPage })

const SCENE_CARD_SIZE_OPTIONS: Array<{ value: ProjectSettings['sceneCardSize']; label: string }> = [
    { value: 'sm', label: 'SM' },
    { value: 'md', label: 'MD' },
    { value: 'lg', label: 'LG' },
]

interface SelectionDragState {
    startIndex: number
    action: 'select' | 'deselect'
    baseSelectedIds: Set<number>
}

function ProjectPage() {
    return (
        <Provider>
            <ProjectPageContent />
        </Provider>
    )
}

function ProjectPageContent() {
    const { projectId } = Route.useParams()
    const queryClient = useQueryClient()
    const projId = Number(projectId)

    const projectQuery = useQuery({
        queryKey: qk.project(projId),
        queryFn: async () => {
            const { data } = await api.projects({ projectId: projId }).get()
            return data ?? null
        },
    })

    const scenesQuery = useQuery({
        queryKey: qk.scenes(projId),
        queryFn: async () => {
            const { data } = await api.scenes.get({ query: { projectId: projId } })
            return data ?? []
        },
    })

    const queueStatusQuery = useQuery({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.queue.status.get()
            return data
        },
    })

    const stashQuery = useQuery({
        queryKey: qk.stash(),
        queryFn: async () => {
            const { data } = await api.stash.get()
            return data ?? []
        },
    })

    const [items, setItems] = useAtom(sceneItemsAtom)
    const [selectedIds, setSelectedIds] = useAtom(selectedSceneIdsSetAtom)
    const [projectDialog, setProjectDialog] = useAtom(projectPageDialogAtom)
    const loadedProjectId = useAtomValue(loadedProjectIdAtom)
    const setLoadedProjectId = useSetAtom(loadedProjectIdAtom)
    const [slideshowImageCount, setSlideshowImageCount] = useAtom(slideshowImageCountAtom)
    const [sceneCardSize, setSceneCardSize] = useAtom(sceneCardSizeAtom)
    const selectedSceneIds = useAtomValue(selectedSceneIdsAtom)
    const selectedCount = useAtomValue(selectedSceneCountAtom)
    const selectMode = useAtomValue(selectModeAtom)
    const hasScenes = useAtomValue(hasScenesAtom)
    const selectionDragRef = useRef<SelectionDragState | null>(null)

    const saveProjectSettings = useRef(
        debounce(async (projectId: number, settings: ProjectSettingsPatch) => {
            const { data } = await api.projects({ projectId }).patch({ settings })
            if (data) queryClient.setQueryData(qk.project(projectId), data)
        }, 600),
    )

    // Sync items from query
    useEffect(() => {
        if (!scenesQuery.data) return

        setItems(scenesQuery.data)
        const availableIds = new Set(scenesQuery.data.map((scene) => scene.id))
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => availableIds.has(id)))
            return next.size === prev.size ? prev : next
        })
    }, [scenesQuery.data, setItems, setSelectedIds])

    useEffect(() => {
        const project = projectQuery.data
        if (project && project.id !== loadedProjectId) {
            saveProjectSettings.current.cancel()
            setLoadedProjectId(project.id)
            setSlideshowImageCount(project.settings.slideshowImageCount)
            setSceneCardSize(project.settings.sceneCardSize)
        }
    }, [
        projectQuery.data,
        loadedProjectId,
        setLoadedProjectId,
        setSceneCardSize,
        setSlideshowImageCount,
    ])

    useEffect(() => {
        return () => saveProjectSettings.current.flush()
    }, [])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    const createScene = useMutation({
        mutationFn: (name: string) => api.scenes.post({ projectId: projId, name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            setProjectDialog(null)
        },
    })

    const reorderScene = useMutation({
        mutationFn: ({
            id,
            prevId,
            nextId,
        }: {
            id: number
            prevId: number | null
            nextId: number | null
        }) => api.scenes({ id }).order.patch({ prevId, nextId }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.scenes(projId) }),
    })

    const bulkEnqueue = useMutation({
        mutationFn: ({ sceneIds, position }: { sceneIds: number[]; position: 'front' | 'back' }) =>
            api.queue['enqueue-bulk'].post({ sceneIds, position }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(projId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            clearSelection()
        },
    })

    const deleteSelectedScenes = useMutation({
        mutationFn: async (sceneIds: number[]) => {
            for (const id of sceneIds) {
                await api.scenes({ id }).delete()
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(projId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            clearSelection()
            setProjectDialog(null)
        },
    })

    const saveStash = useMutation({
        mutationFn: (body: StashPostBody) => api.stash.post(body),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.stash() }),
    })

    const deleteStash = useMutation({
        mutationFn: (id: number) => api.stash({ id }).delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.stash() }),
    })

    const applyStash = useMutation({
        mutationFn: ({ id, mode }: { id: number; mode?: 'append' | 'replace' }) =>
            api.stash({ id }).apply.post({
                projectId: projId,
                mode,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.project(projId) })
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(projId) })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projId) })
            clearSelection()
            setProjectDialog(null)
        },
    })

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const activeId = Number(active.id)
        const overId = Number(over.id)

        if (!Number.isFinite(activeId) || !Number.isFinite(overId)) return

        const reordered = reorderSceneItems(items, activeId, overId)
        if (!reordered) return

        setItems(reordered.items)
        reorderScene.mutate(reordered.orderPatch)
    }

    function applySelectionDragRange(state: SelectionDragState, targetIndex: number) {
        if (items.length === 0) return

        const clampedTargetIndex = Math.min(Math.max(targetIndex, 0), items.length - 1)
        const from = Math.min(state.startIndex, clampedTargetIndex)
        const to = Math.max(state.startIndex, clampedTargetIndex)
        const rangeIds = items.slice(from, to + 1).map((scene) => scene.id)

        setSelectedIds(() => {
            const next = new Set(state.baseSelectedIds)
            for (const id of rangeIds) {
                if (state.action === 'select') next.add(id)
                else next.delete(id)
            }
            return next
        })
    }

    function handleSelectDragStart(index: number, selected: boolean) {
        const state: SelectionDragState = {
            startIndex: index,
            action: selected ? 'deselect' : 'select',
            baseSelectedIds: new Set(selectedIds),
        }

        selectionDragRef.current = state
        applySelectionDragRange(state, index)
    }

    function handleSelectDragEnter(index: number) {
        const state = selectionDragRef.current
        if (!state) return

        applySelectionDragRange(state, index)
    }

    function toggleSelect(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllScenes() {
        setSelectedIds(new Set(items.map((scene) => scene.id)))
    }

    function clearSelection() {
        setSelectedIds(new Set<number>())
    }

    function handleSlideshowImageCountChange(value: string) {
        const nextCount = Math.min(10, Math.max(1, Number(value) || 1))
        setSlideshowImageCount(nextCount)
        if (loadedProjectId) {
            saveProjectSettings.current(loadedProjectId, {
                slideshowImageCount: nextCount,
                sceneCardSize,
            })
        }
    }

    function handleSceneCardSizeChange(value: ProjectSettings['sceneCardSize']) {
        setSceneCardSize(value)
        if (loadedProjectId) {
            saveProjectSettings.current(loadedProjectId, {
                slideshowImageCount,
                sceneCardSize: value,
            })
        }
    }

    useEffect(() => {
        function handlePointerEnd() {
            selectionDragRef.current = null
        }

        window.addEventListener('pointerup', handlePointerEnd)
        window.addEventListener('pointercancel', handlePointerEnd)
        return () => {
            window.removeEventListener('pointerup', handlePointerEnd)
            window.removeEventListener('pointercancel', handlePointerEnd)
        }
    }, [])

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isEditableTarget(event.target)) return

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                if (items.length === 0) return
                event.preventDefault()
                setSelectedIds(new Set(items.map((scene) => scene.id)))
                return
            }

            if (event.key === 'Escape') {
                setSelectedIds(new Set<number>())
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [items, setSelectedIds])
    const currentSceneId = queueStatusQuery.data?.currentSceneId ?? null

    return (
        <div className="flex h-full flex-col gap-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {hasScenes && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => selectAllScenes()}
                            disabled={selectedCount === items.length}
                        >
                            <Check className="h-4 w-4" />
                            전체 선택
                        </Button>
                    )}
                    {selectMode && (
                        <span className="text-xs font-medium text-muted-foreground">
                            {selectedCount}개 선택
                        </span>
                    )}
                    {selectMode && (
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                                bulkEnqueue.mutate({
                                    sceneIds: selectedSceneIds,
                                    position: 'front',
                                })
                            }
                            disabled={bulkEnqueue.isPending}
                        >
                            <ListPlus className="h-4 w-4" />
                            앞으로 추가
                        </Button>
                    )}
                    {selectMode && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() =>
                                bulkEnqueue.mutate({ sceneIds: selectedSceneIds, position: 'back' })
                            }
                            disabled={bulkEnqueue.isPending}
                        >
                            <ListPlus className="h-4 w-4" />
                            뒤로 추가
                        </Button>
                    )}
                    {selectMode && (
                        <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setProjectDialog({ type: 'delete-selected' })}
                            disabled={deleteSelectedScenes.isPending}
                        >
                            <Trash2 className="h-4 w-4" />
                            선택 삭제
                        </Button>
                    )}
                    {selectMode && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => clearSelection()}
                        >
                            <X className="h-4 w-4" />
                            해제
                        </Button>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label="Stash"
                                    onClick={() => setProjectDialog({ type: 'stash' })}
                                    disabled={!projectQuery.data}
                                />
                            }
                        >
                            <Archive className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Stash</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label="프로젝트 설정"
                                    onClick={() => setProjectDialog({ type: 'settings' })}
                                    disabled={!projectQuery.data}
                                />
                            }
                        >
                            <Settings className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>프로젝트 설정</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label="Export"
                                    onClick={() => setProjectDialog({ type: 'export' })}
                                    disabled={!projectQuery.data}
                                />
                            }
                        >
                            <Download className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>Export</TooltipContent>
                    </Tooltip>
                    <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setProjectDialog({ type: 'create-scene' })}
                    >
                        <Plus className="h-4 w-4" />새 씬
                    </Button>
                </div>
            </div>

            {/* Scene grid */}
            {scenesQuery.isPending ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    불러오는 중...
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <p className="text-sm">씬이 없습니다. 새 씬을 추가하세요.</p>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
                        <div className="flex flex-wrap gap-4 pb-4">
                            {items.map((scene, index) => (
                                <SortableSceneItem
                                    key={scene.id}
                                    scene={scene}
                                    index={index}
                                    selected={selectedIds.has(scene.id)}
                                    selectMode={selectMode}
                                    isProcessing={scene.id === currentSceneId}
                                    slideshowCount={slideshowImageCount}
                                    cardSize={sceneCardSize}
                                    onToggleSelect={toggleSelect}
                                    onSelectDragStart={handleSelectDragStart}
                                    onSelectDragEnter={handleSelectDragEnter}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Dialogs / panels */}
            <CreateSceneDialog
                open={projectDialog?.type === 'create-scene'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                onCreate={(name) => createScene.mutate(name)}
            />
            <ConfirmDeleteDialog
                open={projectDialog?.type === 'delete-selected'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                title="선택 씬 삭제"
                description={`선택한 씬 ${selectedCount}개와 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
                onConfirm={() => deleteSelectedScenes.mutateAsync(selectedSceneIds)}
            />
            <ExportDialog
                open={projectDialog?.type === 'export'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                project={projectQuery.data ?? null}
                scenes={items}
                selectedSceneIds={selectedSceneIds}
            />
            <ProjectSettingsDialog
                open={projectDialog?.type === 'settings'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                slideshowImageCount={slideshowImageCount}
                sceneCardSize={sceneCardSize}
                onSlideshowImageCountChange={handleSlideshowImageCountChange}
                onSceneCardSizeChange={handleSceneCardSizeChange}
            />
            <StashDialog
                open={projectDialog?.type === 'stash'}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                project={projectQuery.data}
                scenes={items}
                selectedSceneIds={selectedSceneIds}
                stashItems={stashQuery.data ?? []}
                isPending={saveStash.isPending || deleteStash.isPending || applyStash.isPending}
                onSave={(body) => saveStash.mutateAsync(body)}
                onDelete={(item) => deleteStash.mutateAsync(item.id)}
                onApply={(item, mode) => applyStash.mutateAsync({ id: item.id, mode })}
            />
        </div>
    )
}

interface ProjectSettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    slideshowImageCount: number
    sceneCardSize: ProjectSettings['sceneCardSize']
    onSlideshowImageCountChange: (value: string) => void
    onSceneCardSizeChange: (value: ProjectSettings['sceneCardSize']) => void
}

function ProjectSettingsDialog({
    open,
    onOpenChange,
    slideshowImageCount,
    sceneCardSize,
    onSlideshowImageCountChange,
    onSceneCardSizeChange,
}: ProjectSettingsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>프로젝트 설정</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-[1fr_6rem] items-center gap-3">
                        <Label htmlFor="project-slideshow-image-count">회전 이미지 개수</Label>
                        <Input
                            id="project-slideshow-image-count"
                            type="number"
                            min={1}
                            max={10}
                            value={slideshowImageCount}
                            onChange={(event) => onSlideshowImageCountChange(event.target.value)}
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="grid grid-cols-[1fr_6rem] items-center gap-3">
                        <Label htmlFor="project-scene-card-size">씬 카드 크기</Label>
                        <Select
                            value={sceneCardSize}
                            onValueChange={(value) => {
                                if (value) onSceneCardSizeChange(value)
                            }}
                        >
                            <SelectTrigger id="project-scene-card-size" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SCENE_CARD_SIZE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface StashDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: Project | null | undefined
    scenes: SceneSummary[]
    selectedSceneIds: number[]
    stashItems: StashItem[]
    isPending: boolean
    onSave: (body: StashPostBody) => Promise<unknown>
    onDelete: (item: StashItem) => Promise<unknown>
    onApply: (item: StashItem, mode?: 'append' | 'replace') => Promise<unknown>
}

type StashTab = StashItem['type']

const STASH_TAB_LABELS: Record<StashTab, string> = {
    prompt: '프롬프트',
    scene: '씬',
    parameters: '파라미터',
}

function StashDialog({
    open,
    onOpenChange,
    project,
    scenes,
    selectedSceneIds,
    stashItems,
    isPending,
    onSave,
    onDelete,
    onApply,
}: StashDialogProps) {
    const [activeTab, setActiveTab] = useState<StashTab>('scene')
    const [name, setName] = useState('')
    const [replaceItem, setReplaceItem] = useState<StashItem | null>(null)
    const selectedSceneSet = new Set(selectedSceneIds)
    const stashedItems = stashItems.filter((item) => item.type === activeTab)
    const stashedScenes =
        selectedSceneIds.length > 0
            ? scenes.filter((scene) => selectedSceneSet.has(scene.id))
            : scenes
    const canSave =
        !!project && name.trim().length > 0 && (activeTab !== 'scene' || stashedScenes.length > 0)

    async function handleSave() {
        if (!project) return
        const stashName = name.trim()
        if (!stashName) return

        if (activeTab === 'prompt') {
            await onSave({
                type: 'prompt',
                name: stashName,
                payload: {
                    prompt: project.prompt,
                    negativePrompt: project.negativePrompt,
                    variables: project.variables,
                    characterPrompts: project.characterPrompts,
                },
            })
        } else if (activeTab === 'parameters') {
            await onSave({
                type: 'parameters',
                name: stashName,
                payload: project.parameters,
            })
        } else {
            await onSave({
                type: 'scene',
                name: stashName,
                payload: {
                    scenes: stashedScenes.map((scene) => ({
                        name: scene.name,
                        variations: scene.variations.map((variation) => ({
                            variables: variation.variables,
                        })),
                    })),
                },
            })
        }

        setName('')
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Stash</DialogTitle>
                    </DialogHeader>

                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => setActiveTab(value as StashTab)}
                    >
                        <TabsList className="w-full">
                            <TabsTrigger value="scene">
                                <Layers className="h-4 w-4" />씬
                            </TabsTrigger>
                            <TabsTrigger value="prompt">
                                <FileText className="h-4 w-4" />
                                프롬프트
                            </TabsTrigger>
                            <TabsTrigger value="parameters">
                                <SlidersHorizontal className="h-4 w-4" />
                                파라미터
                            </TabsTrigger>
                        </TabsList>

                        {(['scene', 'prompt', 'parameters'] as const).map((type) => (
                            <TabsContent key={type} value={type} className="mt-2">
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-2">
                                        <Input
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                            placeholder={`${STASH_TAB_LABELS[type]} Stash 이름`}
                                            className="h-8"
                                        />
                                        <Button
                                            size="sm"
                                            className="shrink-0 gap-1.5"
                                            onClick={handleSave}
                                            disabled={isPending || !canSave}
                                        >
                                            <Save className="h-4 w-4" />
                                            저장
                                        </Button>
                                    </div>

                                    {type === 'scene' && (
                                        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
                                            <span>
                                                {selectedSceneIds.length > 0
                                                    ? `선택된 씬 ${stashedScenes.length}개 저장`
                                                    : `전체 씬 ${stashedScenes.length}개 저장`}
                                            </span>
                                            {selectedSceneIds.length > 0 && (
                                                <Badge variant="outline">선택 저장</Badge>
                                            )}
                                        </div>
                                    )}

                                    {stashedItems.length === 0 ? (
                                        <div className="rounded-md border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                                            저장된 Stash가 없습니다
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {stashedItems.map((item) => (
                                                <StashItemRow
                                                    key={item.id}
                                                    item={item}
                                                    isPending={isPending}
                                                    onDelete={onDelete}
                                                    onApply={onApply}
                                                    onReplace={() => setReplaceItem(item)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </DialogContent>
            </Dialog>
            <ConfirmDeleteDialog
                open={replaceItem !== null}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setReplaceItem(null)
                }}
                title="씬 Stash 덮어쓰기"
                description="현재 프로젝트의 모든 씬과 생성된 이미지를 삭제하고 Stash의 씬으로 교체합니다. 되돌릴 수 없습니다."
                onConfirm={async () => {
                    if (!replaceItem) return
                    await onApply(replaceItem, 'replace')
                    setReplaceItem(null)
                }}
            />
        </>
    )
}

interface StashItemRowProps {
    item: StashItem
    isPending: boolean
    onDelete: (item: StashItem) => Promise<unknown>
    onApply: (item: StashItem, mode?: 'append' | 'replace') => Promise<unknown>
    onReplace: () => void
}

function StashItemRow({ item, isPending, onDelete, onApply, onReplace }: StashItemRowProps) {
    const meta =
        item.type === 'scene'
            ? `씬 ${item.payload.scenes.length}개`
            : item.type === 'prompt'
              ? '프로젝트 프롬프트'
              : `${item.payload.width}x${item.payload.height}`

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{meta}</div>
            </div>
            {item.type === 'scene' ? (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onApply(item, 'append')}
                        disabled={isPending}
                    >
                        추가
                    </Button>
                    <Button variant="outline" size="sm" onClick={onReplace} disabled={isPending}>
                        덮어쓰기
                    </Button>
                </>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApply(item)}
                    disabled={isPending}
                >
                    적용
                </Button>
            )}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${item.name} Stash 삭제`}
                onClick={() => onDelete(item)}
                disabled={isPending}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    )
}

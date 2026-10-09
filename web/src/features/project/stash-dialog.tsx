import type { Project, SceneSummary, StashCreateBody, StashItem } from '@nai-factory/shared'
import { FileText, Layers, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface StashDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: Project | null | undefined
    scenes: SceneSummary[]
    selectedSceneIds: number[]
    stashItems: StashItem[]
    isPending: boolean
    onSave: (body: StashCreateBody) => Promise<unknown>
    onDelete: (item: StashItem) => Promise<unknown>
    onApply: (item: StashItem, mode?: 'append' | 'replace') => Promise<unknown>
}

type StashTab = StashItem['type']

const STASH_TAB_LABELS: Record<StashTab, string> = {
    prompt: '프롬프트',
    scene: '씬',
    parameters: '파라미터',
}

export function StashDialog({
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

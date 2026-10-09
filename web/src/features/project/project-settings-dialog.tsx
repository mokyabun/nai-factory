import type { Project, ProjectSettings, SceneSummary } from '@nai-factory/shared'

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

import { ProjectFilesSettings } from './project-files-settings'

const SCENE_CARD_SIZE_OPTIONS: Array<{ value: ProjectSettings['sceneCardSize']; label: string }> = [
    { value: 'sm', label: 'SM' },
    { value: 'md', label: 'MD' },
    { value: 'lg', label: 'LG' },
]

export interface ProjectSettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    slideshowImageCount: number
    sceneCardSize: ProjectSettings['sceneCardSize']
    project: Project | null
    scenes: SceneSummary[]
    selectedSceneIds: number[]
    onSlideshowImageCountChange: (value: string) => void
    onSceneCardSizeChange: (value: ProjectSettings['sceneCardSize']) => void
}

export function ProjectSettingsDialog({
    open,
    onOpenChange,
    slideshowImageCount,
    sceneCardSize,
    project,
    scenes,
    selectedSceneIds,
    onSlideshowImageCountChange,
    onSceneCardSizeChange,
}: ProjectSettingsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>프로젝트 설정</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="general" className="min-h-0">
                    <TabsList>
                        <TabsTrigger value="general">일반</TabsTrigger>
                        <TabsTrigger value="files">씬 / 아카이브</TabsTrigger>
                    </TabsList>
                    <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">
                        <TabsContent value="general" className="flex flex-col gap-4">
                            <div className="grid grid-cols-[1fr_6rem] items-center gap-3">
                                <Label htmlFor="project-slideshow-image-count">
                                    회전 이미지 개수
                                </Label>
                                <Input
                                    id="project-slideshow-image-count"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={slideshowImageCount}
                                    onChange={(event) =>
                                        onSlideshowImageCountChange(event.target.value)
                                    }
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
                        </TabsContent>
                        <TabsContent value="files">
                            <ProjectFilesSettings
                                project={project}
                                scenes={scenes}
                                selectedSceneIds={selectedSceneIds}
                                onImported={() => onOpenChange(false)}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

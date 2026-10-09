import type { Project, ProjectSettings, SceneSummary } from '@nai-factory/shared'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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

import { ProjectArchiveSettings } from './project-archive-settings'
import { SceneJsonSettings } from './scene-json-settings'

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
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="px-5 pt-5 pb-4">
                    <DialogTitle>프로젝트 설정</DialogTitle>
                    <DialogDescription>{project?.name}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="general" className="min-h-0 flex-1 gap-0">
                    <TabsList className="mx-5 w-auto">
                        <TabsTrigger value="general">일반</TabsTrigger>
                        <TabsTrigger value="scenes">씬</TabsTrigger>
                        <TabsTrigger value="archive">아카이브</TabsTrigger>
                    </TabsList>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5">
                        <TabsContent value="general">
                            <div className="divide-y border">
                                <SettingRow
                                    htmlFor="project-slideshow-image-count"
                                    label="회전 이미지 개수"
                                    description="씬 카드에서 돌아가며 보여줄 이미지 수 (1–10)"
                                >
                                    <Input
                                        id="project-slideshow-image-count"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={slideshowImageCount}
                                        onChange={(event) =>
                                            onSlideshowImageCountChange(event.target.value)
                                        }
                                        className="w-24"
                                    />
                                </SettingRow>
                                <SettingRow
                                    htmlFor="project-scene-card-size"
                                    label="씬 카드 크기"
                                    description="씬 목록에 표시되는 카드 크기"
                                >
                                    <Select
                                        value={sceneCardSize}
                                        onValueChange={(value) => {
                                            if (value) onSceneCardSizeChange(value)
                                        }}
                                    >
                                        <SelectTrigger
                                            id="project-scene-card-size"
                                            className="w-24"
                                        >
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
                                </SettingRow>
                            </div>
                        </TabsContent>
                        <TabsContent value="scenes">
                            <SceneJsonSettings
                                project={project}
                                scenes={scenes}
                                selectedSceneIds={selectedSceneIds}
                            />
                        </TabsContent>
                        <TabsContent value="archive">
                            <ProjectArchiveSettings
                                project={project}
                                onImported={() => onOpenChange(false)}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

interface SettingRowProps {
    htmlFor: string
    label: string
    description: string
    children: React.ReactNode
}

function SettingRow({ htmlFor, label, description, children }: SettingRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor={htmlFor}>{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {children}
        </div>
    )
}

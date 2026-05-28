import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
    closestCenter,
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { useAtom } from 'jotai'
import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId } from '@/lib/api'
import { activeProjectDragIdAtom, type ProjectSummary } from './atom'
import { ProjectGroup } from './project-group'
import { ProjectDragPreview, SidebarMessage } from './project-tree-parts'
import type { ProjectTreeProps } from './project-tree-types'
import { RootProjects } from './root-projects'

export function ProjectTree({
    groups,
    isLoading,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: ProjectTreeProps) {
    const [activeProjectId, setActiveProjectId] = useAtom(activeProjectDragIdAtom)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
    const groupItems = useMemo(
        () => groups.filter((group): group is GroupWithProjects => group.type === 'group'),
        [groups],
    )
    const ungroupedProjects = useMemo(
        () => groups.find((group) => group.type === 'ungrouped')?.projects ?? [],
        [groups],
    )
    const activeProject = useMemo(
        () =>
            activeProjectId === null
                ? null
                : (groups
                      .flatMap((group) => group.projects)
                      .find((project) => project.id === activeProjectId) ?? null),
        [activeProjectId, groups],
    )

    function handleDragStart(event: DragStartEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        setActiveProjectId(project?.id ?? null)
    }

    function handleDragEnd(event: DragEndEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        const groupId = (event.over?.data.current?.groupId ?? null) as ProjectGroupId

        setActiveProjectId(null)

        if (!project || project.groupId === groupId) return
        actions.moveProject(project, groupId)
    }

    return (
        <Base.SidebarGroup>
            <Base.SidebarGroupLabel className="flex items-center justify-between pr-1">
                <span>프로젝트</span>
                <button
                    type="button"
                    className="rounded p-0.5 hover:bg-sidebar-accent"
                    onClick={actions.createGroup}
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </Base.SidebarGroupLabel>

            <Base.SidebarGroupContent>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveProjectId(null)}
                >
                    <Base.SidebarMenu>
                        {isLoading ? (
                            <SidebarMessage>불러오는 중...</SidebarMessage>
                        ) : groupItems.length === 0 && ungroupedProjects.length === 0 ? (
                            <SidebarMessage>프로젝트가 없습니다</SidebarMessage>
                        ) : (
                            <>
                                {groupItems.map((group) => (
                                    <ProjectGroup
                                        key={group.id}
                                        group={group}
                                        currentProjectId={currentProjectId}
                                        rename={rename}
                                        actions={actions}
                                        onRenameValueChange={onRenameValueChange}
                                        onCommitRename={onCommitRename}
                                        onCancelRename={onCancelRename}
                                    />
                                ))}
                                <RootProjects
                                    projects={ungroupedProjects}
                                    currentProjectId={currentProjectId}
                                    rename={rename}
                                    actions={actions}
                                    onRenameValueChange={onRenameValueChange}
                                    onCommitRename={onCommitRename}
                                    onCancelRename={onCancelRename}
                                />
                            </>
                        )}
                    </Base.SidebarMenu>
                    <DragOverlay>
                        {activeProject && <ProjectDragPreview project={activeProject} />}
                    </DragOverlay>
                </DndContext>
            </Base.SidebarGroupContent>
        </Base.SidebarGroup>
    )
}

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
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId } from '@/lib/api'
import { activeGroupDragIdAtom, activeProjectDragIdAtom, type ProjectSummary } from './atom'
import { ProjectGroup } from './project-group'
import { GroupDragPreview, ProjectDragPreview, SidebarMessage } from './project-tree-parts'
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
    const [activeGroupId, setActiveGroupId] = useAtom(activeGroupDragIdAtom)
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
                : (ungroupedProjects.find((project) => project.id === activeProjectId) ??
                  groupItems
                      .flatMap((group) => flattenGroupProjects(group))
                      .find((project) => project.id === activeProjectId) ??
                  null),
        [activeProjectId, groupItems, ungroupedProjects],
    )
    const activeGroup = useMemo(
        () =>
            activeGroupId === null
                ? null
                : (groupItems
                      .flatMap((group) => flattenGroupTree(group))
                      .find((group) => group.id === activeGroupId) ?? null),
        [activeGroupId, groupItems],
    )

    function handleDragStart(event: DragStartEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        const group = event.active.data.current?.group as GroupWithProjects | undefined
        setActiveProjectId(project?.id ?? null)
        setActiveGroupId(group?.id ?? null)
    }

    function handleDragEnd(event: DragEndEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        const group = event.active.data.current?.group as GroupWithProjects | undefined

        setActiveProjectId(null)
        setActiveGroupId(null)

        if (!event.over) return

        const groupId = (event.over.data.current?.groupId ?? null) as ProjectGroupId

        if (project) {
            if (project.groupId === groupId) return
            actions.moveProject(project, groupId)
            return
        }

        if (!group) return
        if (group.parentGroupId === groupId) return
        if (group.id === groupId) return
        if (groupId !== null && isDescendantGroup(group, groupId)) return

        actions.moveGroup(group, groupId)
    }

    return (
        <Base.SidebarGroup className="min-h-0 flex-1">
            <Base.SidebarGroupLabel className="flex items-center justify-between pr-1">
                <span>프로젝트</span>
                <button
                    type="button"
                    className="rounded p-0.5 hover:bg-sidebar-accent"
                    onClick={() => actions.createGroup(null)}
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </Base.SidebarGroupLabel>

            <Base.SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
                <ContextMenu>
                    <ContextMenuTrigger render={<div className="flex min-h-8 flex-1 flex-col" />}>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragCancel={() => {
                                setActiveProjectId(null)
                                setActiveGroupId(null)
                            }}
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
                            <DragOverlay dropAnimation={null}>
                                {activeProject && <ProjectDragPreview project={activeProject} />}
                                {activeGroup && <GroupDragPreview group={activeGroup} />}
                            </DragOverlay>
                        </DndContext>
                    </ContextMenuTrigger>

                    <ContextMenuContent>
                        <ContextMenuItem onClick={() => actions.createProject(null)}>
                            새 프로젝트
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => actions.createGroup(null)}>
                            새 그룹
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </Base.SidebarGroupContent>
        </Base.SidebarGroup>
    )
}

function flattenGroupTree(group: GroupWithProjects): GroupWithProjects[] {
    return [group, ...group.groups.flatMap((childGroup) => flattenGroupTree(childGroup))]
}

function flattenGroupProjects(group: GroupWithProjects): ProjectSummary[] {
    return [
        ...group.projects,
        ...group.groups.flatMap((childGroup) => flattenGroupProjects(childGroup)),
    ]
}

function isDescendantGroup(group: GroupWithProjects, groupId: number): boolean {
    return group.groups.some(
        (childGroup) => childGroup.id === groupId || isDescendantGroup(childGroup, groupId),
    )
}

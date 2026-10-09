import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
    closestCenter,
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import type { GroupNode, GroupTreeItem } from '@nai-factory/shared'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import * as Base from '@/components/ui/sidebar'

import { GroupDragPreview, ProjectDragPreview } from './drag-previews'
import { ProjectGroup, type ProjectGroupProps } from './project-group'
import type { ProjectGroupId, ProjectSummary } from './project-tree-model'
import { RootProjects } from './root-projects'

interface ProjectTreeProps extends Omit<ProjectGroupProps, 'group' | 'depth'> {
    groups: GroupTreeItem[]
    isLoading: boolean
}

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
    const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
    const [activeGroupId, setActiveGroupId] = useState<number | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
    const groupItems = useMemo(
        () => groups.filter((group): group is GroupNode => group.type === 'group'),
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
        const group = event.active.data.current?.group as GroupNode | undefined
        setActiveProjectId(project?.id ?? null)
        setActiveGroupId(group?.id ?? null)
    }

    function handleDragEnd(event: DragEndEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        const group = event.active.data.current?.group as GroupNode | undefined

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
        if (group.parentId === groupId) return
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
                    aria-label="새 그룹"
                    className="flex size-7 items-center justify-center hover:bg-sidebar-accent"
                    onClick={() => actions.createGroup(null)}
                >
                    <Plus className="size-4" />
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
                                    <TreeMessage>불러오는 중...</TreeMessage>
                                ) : groupItems.length === 0 && ungroupedProjects.length === 0 ? (
                                    <TreeMessage>프로젝트가 없습니다</TreeMessage>
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

function flattenGroupTree(group: GroupNode): GroupNode[] {
    return [group, ...group.groups.flatMap((childGroup) => flattenGroupTree(childGroup))]
}

function flattenGroupProjects(group: GroupNode): ProjectSummary[] {
    return [
        ...group.projects,
        ...group.groups.flatMap((childGroup) => flattenGroupProjects(childGroup)),
    ]
}

function isDescendantGroup(group: GroupNode, groupId: number): boolean {
    return group.groups.some(
        (childGroup) => childGroup.id === groupId || isDescendantGroup(childGroup, groupId),
    )
}

function TreeMessage({ children }: { children: string }) {
    return <div className="px-2 py-4 text-center text-xs text-muted-foreground">{children}</div>
}

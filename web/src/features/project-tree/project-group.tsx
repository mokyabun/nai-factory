import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { GroupNode } from '@nai-factory/shared'
import { ChevronRight, Folder } from 'lucide-react'
import { useCallback } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import * as Base from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { GroupContextMenuContent, GroupMenu } from './group-menu'
import { ProjectRow } from './project-row'
import {
    isSameRenameTarget,
    type ActiveRenameTarget,
    type ProjectTreeActions,
    type RenameState,
} from './project-tree-model'
import { RenameInput } from './rename-input'
import { useCollapsedGroups } from './use-collapsed-groups'

export interface ProjectGroupProps {
    group: GroupNode
    depth?: number
    currentProjectId: number | null
    rename: RenameState
    actions: ProjectTreeActions
    onRenameValueChange: (value: string) => void
    onCommitRename: (target: ActiveRenameTarget) => void
    onCancelRename: () => void
}

export function ProjectGroup({
    group,
    depth = 0,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: ProjectGroupProps) {
    const collapsedGroups = useCollapsedGroups()
    const groupRenameTarget = { type: 'group', id: group.id } as const
    const isRenaming = isSameRenameTarget(rename.target, groupRenameTarget)
    const droppableId = `project-group:${group.id}`
    const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
        id: droppableId,
        data: { groupId: group.id },
    })
    const {
        attributes,
        listeners,
        setNodeRef: setDragNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: `group:${group.id}`,
        data: { group },
        disabled: isRenaming,
    })
    const groupMenuActions = {
        onCreateGroup: () => actions.createGroup(group),
        onCreateProject: () => actions.createProject(group),
        onRename: () => actions.renameGroup(group),
        onDelete: () => actions.deleteGroup(group),
    }
    const Container = depth === 0 ? Base.SidebarMenuItem : Base.SidebarMenuSubItem
    const isEmpty = group.groups.length === 0 && group.projects.length === 0
    const isOpen = !collapsedGroups.isCollapsed(group.id)
    const setNodeRef = useCallback(
        (node: HTMLElement | null) => {
            setDropNodeRef(node)
            setDragNodeRef(node)
        },
        [setDropNodeRef, setDragNodeRef],
    )
    const style = {
        transform: CSS.Translate.toString(transform),
    }

    return (
        <Container ref={setNodeRef} style={style}>
            <Collapsible
                open={isOpen}
                onOpenChange={(open) => {
                    collapsedGroups.setCollapsed(group.id, !open)
                }}
                className={cn(
                    'group/collapsible transition-colors',
                    isOver && 'bg-primary/10 text-primary',
                    isDragging && 'opacity-40',
                )}
            >
                <ContextMenu>
                    <ContextMenuTrigger
                        render={
                            <div
                                className={cn(
                                    'flex items-center gap-0.5 pr-1 transition-colors',
                                    isOver && 'text-primary',
                                )}
                            />
                        }
                    >
                        <CollapsibleTrigger
                            render={
                                <button
                                    type="button"
                                    className="flex h-8 min-w-0 flex-1 cursor-grab items-center gap-2 rounded-none px-2 text-sm hover:bg-sidebar-accent active:cursor-grabbing"
                                    {...attributes}
                                    {...listeners}
                                />
                            }
                        >
                            <ChevronRight className="chevron size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            <Folder className="size-4 shrink-0" />
                            {isRenaming ? (
                                <RenameInput
                                    className="h-7 min-w-0 flex-1 px-1.5"
                                    value={rename.value}
                                    onChange={onRenameValueChange}
                                    onCommit={() => onCommitRename(groupRenameTarget)}
                                    onCancel={onCancelRename}
                                    stopClickPropagation
                                />
                            ) : (
                                <span className="truncate">{group.name}</span>
                            )}
                        </CollapsibleTrigger>

                        <GroupMenu {...groupMenuActions} />
                    </ContextMenuTrigger>

                    <GroupContextMenuContent {...groupMenuActions} />
                </ContextMenu>

                <CollapsibleContent>
                    <Base.SidebarMenuSub>
                        {isEmpty ? (
                            <div
                                className={cn(
                                    'flex h-8 items-center px-2 text-xs text-muted-foreground transition-colors',
                                    isOver && 'text-primary',
                                )}
                            >
                                비어 있음
                            </div>
                        ) : (
                            <>
                                {group.groups.map((childGroup) => (
                                    <ProjectGroup
                                        key={childGroup.id}
                                        group={childGroup}
                                        depth={depth + 1}
                                        currentProjectId={currentProjectId}
                                        rename={rename}
                                        actions={actions}
                                        onRenameValueChange={onRenameValueChange}
                                        onCommitRename={onCommitRename}
                                        onCancelRename={onCancelRename}
                                    />
                                ))}
                                {group.projects.map((project) => (
                                    <ProjectRow
                                        key={project.id}
                                        project={project}
                                        variant="sub"
                                        dropGroupId={group.id}
                                        isActive={currentProjectId === project.id}
                                        isRenaming={isSameRenameTarget(rename.target, {
                                            type: 'project',
                                            id: project.id,
                                        })}
                                        renameValue={rename.value}
                                        onRenameValueChange={onRenameValueChange}
                                        onCommitRename={() =>
                                            onCommitRename({ type: 'project', id: project.id })
                                        }
                                        onCancelRename={onCancelRename}
                                        onPreload={() => actions.preloadProject(project)}
                                        onSelect={() => actions.selectProject(project)}
                                        onRename={() => actions.renameProject(project)}
                                        onDuplicate={() => actions.duplicateProject(project)}
                                        onDelete={() => actions.deleteProject(project)}
                                    />
                                ))}
                            </>
                        )}
                    </Base.SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </Container>
    )
}

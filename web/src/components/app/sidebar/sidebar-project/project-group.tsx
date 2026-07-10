import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useAtomValue, useSetAtom } from 'jotai'
import { ChevronRight, Folder } from 'lucide-react'
import { useCallback } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import * as Base from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { collapsedGroupIdsAtom, setGroupCollapsedAtom } from './atom'
import { ProjectRow } from './project-row'
import { GroupContextMenuContent, GroupMenu, RenameInput } from './project-tree-parts'
import type { ProjectGroupProps } from './project-tree-types'
import { isSameRenameTarget } from './project-tree-utils'

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
    const collapsedGroupIds = useAtomValue(collapsedGroupIdsAtom)
    const setGroupCollapsed = useSetAtom(setGroupCollapsedAtom)
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
    const isOpen = !collapsedGroupIds.has(group.id)
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
                    setGroupCollapsed({ groupId: group.id, collapsed: !open })
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
                                    className="flex flex-1 cursor-grab items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent active:cursor-grabbing"
                                    {...attributes}
                                    {...listeners}
                                />
                            }
                        >
                            <ChevronRight className="chevron h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            <Folder className="h-3.5 w-3.5 shrink-0" />
                            {isRenaming ? (
                                <RenameInput
                                    className="h-5 flex-1 px-1 py-0 text-xs"
                                    value={rename.value}
                                    onChange={onRenameValueChange}
                                    onCommit={() => onCommitRename(groupRenameTarget)}
                                    onCancel={onCancelRename}
                                    stopClickPropagation
                                />
                            ) : (
                                <span className="truncate text-xs">{group.name}</span>
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
                                    'py-1 pl-8 text-xs text-muted-foreground transition-colors',
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

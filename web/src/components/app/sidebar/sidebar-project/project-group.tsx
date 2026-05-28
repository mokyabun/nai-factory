import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, Folder } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import * as Base from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { ProjectRow } from './project-row'
import { GroupMenu, RenameInput } from './project-tree-parts'
import type { ProjectGroupProps } from './project-tree-types'
import { isSameRenameTarget } from './project-tree-utils'

export function ProjectGroup({
    group,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: ProjectGroupProps) {
    const droppableId = `project-group:${group.id}`
    const { isOver, setNodeRef } = useDroppable({
        id: droppableId,
        data: { groupId: group.id },
    })
    const groupRenameTarget = { type: 'group', id: group.id } as const
    const isRenaming = isSameRenameTarget(rename.target, groupRenameTarget)

    return (
        <Base.SidebarMenuItem ref={setNodeRef}>
            <Collapsible defaultOpen className="group/collapsible">
                <div
                    className={cn(
                        'flex items-center gap-0.5 pr-1 transition-colors',
                        isOver && 'bg-sidebar-accent',
                    )}
                >
                    <CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                className="flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent"
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

                    <GroupMenu
                        onCreateProject={() => actions.createProject(group)}
                        onRename={() => actions.renameGroup(group)}
                        onDelete={() => actions.deleteGroup(group)}
                    />
                </div>

                <CollapsibleContent>
                    <Base.SidebarMenuSub>
                        {group.projects.length === 0 ? (
                            <div
                                className={cn(
                                    'py-1 pl-8 text-xs text-muted-foreground transition-colors',
                                    isOver && 'text-sidebar-accent-foreground',
                                )}
                            >
                                프로젝트 없음
                            </div>
                        ) : (
                            group.projects.map((project) => (
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
                            ))
                        )}
                    </Base.SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </Base.SidebarMenuItem>
    )
}

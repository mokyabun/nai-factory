import { useDroppable } from '@dnd-kit/core'
import * as Base from '@/components/ui/sidebar'
import type { ProjectGroupId } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ProjectRow } from './project-row'
import type { RootProjectsProps } from './project-tree-types'
import { isSameRenameTarget } from './project-tree-utils'

export function RootProjects({
    projects,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: RootProjectsProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: 'project-root',
        data: { groupId: null satisfies ProjectGroupId },
    })

    if (projects.length === 0) {
        return (
            <Base.SidebarMenuItem ref={setNodeRef}>
                <div
                    className={cn('mt-1 min-h-4 transition-colors', isOver && 'bg-sidebar-accent')}
                />
            </Base.SidebarMenuItem>
        )
    }

    return (
        <Base.SidebarMenuItem ref={setNodeRef}>
            <div className={cn('mt-1 flex flex-col gap-0.5', isOver && 'bg-sidebar-accent')}>
                {projects.map((project) => (
                    <ProjectRow
                        key={project.id}
                        project={project}
                        variant="root"
                        dropGroupId={null}
                        isActive={currentProjectId === project.id}
                        isRenaming={isSameRenameTarget(rename.target, {
                            type: 'project',
                            id: project.id,
                        })}
                        renameValue={rename.value}
                        onRenameValueChange={onRenameValueChange}
                        onCommitRename={() => onCommitRename({ type: 'project', id: project.id })}
                        onCancelRename={onCancelRename}
                        onPreload={() => actions.preloadProject(project)}
                        onSelect={() => actions.selectProject(project)}
                        onRename={() => actions.renameProject(project)}
                        onDuplicate={() => actions.duplicateProject(project)}
                        onDelete={() => actions.deleteProject(project)}
                    />
                ))}
            </div>
        </Base.SidebarMenuItem>
    )
}

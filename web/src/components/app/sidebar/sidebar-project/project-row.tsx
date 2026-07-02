import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { File } from 'lucide-react'
import { useCallback } from 'react'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import * as Base from '@/components/ui/sidebar'
import type { ProjectGroupId } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ProjectSummary } from './atom'
import { ProjectContextMenuContent, ProjectMenu, RenameInput } from './project-tree-parts'

interface ProjectRowProps {
    project: ProjectSummary
    variant: 'root' | 'sub'
    dropGroupId: ProjectGroupId
    isActive: boolean
    isRenaming: boolean
    renameValue: string
    onRenameValueChange: (value: string) => void
    onCommitRename: () => void
    onCancelRename: () => void
    onPreload: () => void
    onSelect: () => void
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}

export function ProjectRow({
    project,
    variant,
    dropGroupId,
    isActive,
    isRenaming,
    renameValue,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onPreload,
    onSelect,
    onRename,
    onDuplicate,
    onDelete,
}: ProjectRowProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `project:${project.id}`,
        data: { project },
        disabled: isRenaming,
    })
    const { setNodeRef: setDropNodeRef } = useDroppable({
        id: `project-row:${project.id}`,
        data: { groupId: dropGroupId },
        disabled: isRenaming,
    })
    const setRowRef = useCallback(
        (node: HTMLElement | null) => {
            setNodeRef(node)
            setDropNodeRef(node)
        },
        [setNodeRef, setDropNodeRef],
    )
    const style = {
        transform: CSS.Translate.toString(transform),
    }
    const projectMenuActions = {
        onRename,
        onDuplicate,
        onDelete,
    }

    const row = (
        <ContextMenu>
            <ContextMenuTrigger
                render={
                    <div
                        className={cn(
                            'group/project flex items-center gap-0.5 pr-1',
                            isDragging && 'opacity-40',
                        )}
                    />
                }
            >
                {isRenaming ? (
                    <RenameInput
                        className="h-6 flex-1 px-1 py-0 text-xs"
                        value={renameValue}
                        onChange={onRenameValueChange}
                        onCommit={onCommitRename}
                        onCancel={onCancelRename}
                    />
                ) : variant === 'root' ? (
                    <Base.SidebarMenuButton
                        isActive={isActive}
                        className="h-7 flex-1 cursor-grab px-2 active:cursor-grabbing"
                        onMouseEnter={onPreload}
                        onFocus={onPreload}
                        onClick={onSelect}
                        {...attributes}
                        {...listeners}
                    >
                        <File className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{project.name}</span>
                    </Base.SidebarMenuButton>
                ) : (
                    <Base.SidebarMenuSubButton
                        isActive={isActive}
                        className="flex-1 cursor-grab active:cursor-grabbing"
                        onMouseEnter={onPreload}
                        onFocus={onPreload}
                        onClick={onSelect}
                        {...attributes}
                        {...listeners}
                    >
                        <File className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{project.name}</span>
                    </Base.SidebarMenuSubButton>
                )}

                <ProjectMenu {...projectMenuActions} />
            </ContextMenuTrigger>

            <ProjectContextMenuContent {...projectMenuActions} />
        </ContextMenu>
    )

    if (variant === 'root') {
        return (
            <div ref={setRowRef} style={style}>
                {row}
            </div>
        )
    }

    return (
        <Base.SidebarMenuSubItem ref={setRowRef} style={style}>
            {row}
        </Base.SidebarMenuSubItem>
    )
}

import { File, MoreHorizontal } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { ProjectSummary } from './atom'

interface GroupMenuActions {
    onCreateProject: () => void
    onRename: () => void
    onDelete: () => void
}

interface ProjectMenuActions {
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}

export function ProjectDragPreview({ project }: { project: ProjectSummary }) {
    return (
        <div className="flex h-7 min-w-36 items-center gap-2 border bg-popover px-2 text-xs text-popover-foreground shadow">
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.name}</span>
        </div>
    )
}

interface RenameInputProps {
    className?: string
    value: string
    stopClickPropagation?: boolean
    onChange: (value: string) => void
    onCommit: () => void
    onCancel: () => void
}

export function RenameInput({
    className,
    value,
    stopClickPropagation = false,
    onChange,
    onCommit,
    onCancel,
}: RenameInputProps) {
    const skipBlurCommit = useRef(false)

    return (
        <Input
            className={className}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
                if (skipBlurCommit.current) {
                    skipBlurCommit.current = false
                    return
                }
                onCommit()
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCommit()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCancel()
                }
            }}
            autoFocus
            onClick={stopClickPropagation ? (event) => event.stopPropagation() : undefined}
        />
    )
}

export function GroupMenu({ onCreateProject, onRename, onDelete }: GroupMenuActions) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/collapsible:opacity-100"
                    />
                }
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onCreateProject}>새 프로젝트</DropdownMenuItem>
                <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                >
                    삭제
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function GroupContextMenuContent({ onCreateProject, onRename, onDelete }: GroupMenuActions) {
    return (
        <ContextMenuContent>
            <ContextMenuItem onClick={onCreateProject}>새 프로젝트</ContextMenuItem>
            <ContextMenuItem onClick={onRename}>이름 변경</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                삭제
            </ContextMenuItem>
        </ContextMenuContent>
    )
}

export function ProjectMenu({ onRename, onDuplicate, onDelete }: ProjectMenuActions) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/project:opacity-100"
                    />
                }
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>복제</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                >
                    삭제
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function ProjectContextMenuContent({ onRename, onDuplicate, onDelete }: ProjectMenuActions) {
    return (
        <ContextMenuContent>
            <ContextMenuItem onClick={onRename}>이름 변경</ContextMenuItem>
            <ContextMenuItem onClick={onDuplicate}>복제</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                삭제
            </ContextMenuItem>
        </ContextMenuContent>
    )
}

export function SidebarMessage({ children }: { children: string }) {
    return <div className="px-2 py-4 text-center text-xs text-muted-foreground">{children}</div>
}

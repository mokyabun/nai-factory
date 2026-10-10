import { MoreHorizontal } from 'lucide-react'

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

interface ProjectMenuActions {
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}

export function ProjectMenu({ onRename, onDuplicate, onDelete }: ProjectMenuActions) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 opacity-0 group-hover/project:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
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

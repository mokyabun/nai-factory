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

interface GroupMenuActions {
    onCreateGroup: () => void
    onCreateProject: () => void
    onRename: () => void
    onDelete: () => void
}

export function GroupMenu({
    onCreateGroup,
    onCreateProject,
    onRename,
    onDelete,
}: GroupMenuActions) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 opacity-0 group-hover/collapsible:opacity-100 aria-expanded:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    />
                }
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onCreateGroup}>새 하위 그룹</DropdownMenuItem>
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

export function GroupContextMenuContent({
    onCreateGroup,
    onCreateProject,
    onRename,
    onDelete,
}: GroupMenuActions) {
    return (
        <ContextMenuContent>
            <ContextMenuItem onClick={onCreateGroup}>새 하위 그룹</ContextMenuItem>
            <ContextMenuItem onClick={onCreateProject}>새 프로젝트</ContextMenuItem>
            <ContextMenuItem onClick={onRename}>이름 변경</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                삭제
            </ContextMenuItem>
        </ContextMenuContent>
    )
}

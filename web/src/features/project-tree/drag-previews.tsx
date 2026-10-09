import type { GroupNode } from '@nai-factory/shared'
import { File, Folder } from 'lucide-react'

import type { ProjectSummary } from './project-tree-model'

export function ProjectDragPreview({ project }: { project: ProjectSummary }) {
    return (
        <div className="flex h-8 min-w-36 items-center gap-2 border bg-popover px-2 text-sm text-popover-foreground shadow">
            <File className="size-4 shrink-0" />
            <span className="truncate">{project.name}</span>
        </div>
    )
}

export function GroupDragPreview({ group }: { group: GroupNode }) {
    return (
        <div className="flex h-8 min-w-36 items-center gap-2 border bg-popover px-2 text-sm text-popover-foreground shadow">
            <Folder className="size-4 shrink-0" />
            <span className="truncate">{group.name}</span>
        </div>
    )
}

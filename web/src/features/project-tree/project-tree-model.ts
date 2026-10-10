import type { GroupNode, ProjectSummary } from '@nai-factory/shared'

export type { ProjectSummary }

export type ProjectGroupId = number | null

export type ActiveRenameTarget = { type: 'group'; id: number } | { type: 'project'; id: number }
export type DeleteTarget =
    | { type: 'group'; group: GroupNode }
    | { type: 'project'; project: ProjectSummary }
export type ProjectDialog =
    | { type: 'create-group'; group: GroupNode | null }
    | { type: 'create-project'; group: GroupNode | null }
    | { type: 'delete'; target: DeleteTarget }

export interface RenameState {
    target: ActiveRenameTarget | null
    value: string
}

export interface ProjectTreeActions {
    createGroup: (group: GroupNode | null) => void
    createProject: (group: GroupNode | null) => void
    renameGroup: (group: GroupNode) => void
    deleteGroup: (group: GroupNode) => void
    selectProject: (project: ProjectSummary) => void
    preloadProject: (project: ProjectSummary) => void
    renameProject: (project: ProjectSummary) => void
    duplicateProject: (project: ProjectSummary) => void
    moveProject: (project: ProjectSummary, groupId: ProjectGroupId) => void
    moveGroup: (group: GroupNode, parentId: ProjectGroupId) => void
    deleteProject: (project: ProjectSummary) => void
}

export function isSameRenameTarget(current: ActiveRenameTarget | null, target: ActiveRenameTarget) {
    return current?.type === target.type && current.id === target.id
}

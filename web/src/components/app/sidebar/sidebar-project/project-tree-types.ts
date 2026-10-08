import type { GroupNode, GroupTreeItem } from '@nai-factory/shared'

export type ProjectGroupId = number | null

import type { ActiveRenameTarget, ProjectSummary } from './atom'

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

export interface ProjectTreeProps {
    groups: GroupTreeItem[]
    isLoading: boolean
    currentProjectId: number | null
    rename: RenameState
    actions: ProjectTreeActions
    onRenameValueChange: (value: string) => void
    onCommitRename: (target: ActiveRenameTarget) => void
    onCancelRename: () => void
}

export interface ProjectGroupProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    group: GroupNode
    depth?: number
}

export interface RootProjectsProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    projects: ProjectSummary[]
}

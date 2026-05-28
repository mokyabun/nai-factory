import type { GroupWithProjects, ProjectGroupId, ProjectGroupItem } from '@/lib/api'
import type { ActiveRenameTarget, ProjectSummary } from './atom'

export interface RenameState {
    target: ActiveRenameTarget | null
    value: string
}

export interface ProjectTreeActions {
    createGroup: () => void
    createProject: (group: GroupWithProjects) => void
    renameGroup: (group: GroupWithProjects) => void
    deleteGroup: (group: GroupWithProjects) => void
    selectProject: (project: ProjectSummary) => void
    preloadProject: (project: ProjectSummary) => void
    renameProject: (project: ProjectSummary) => void
    duplicateProject: (project: ProjectSummary) => void
    moveProject: (project: ProjectSummary, groupId: ProjectGroupId) => void
    deleteProject: (project: ProjectSummary) => void
}

export interface ProjectTreeProps {
    groups: ProjectGroupItem[]
    isLoading: boolean
    currentProjectId: number | null
    rename: RenameState
    actions: ProjectTreeActions
    onRenameValueChange: (value: string) => void
    onCommitRename: (target: ActiveRenameTarget) => void
    onCancelRename: () => void
}

export interface ProjectGroupProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    group: GroupWithProjects
}

export interface RootProjectsProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    projects: ProjectSummary[]
}

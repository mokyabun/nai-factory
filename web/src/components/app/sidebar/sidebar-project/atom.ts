import { atom } from 'jotai'
import type { GroupWithProjects, ProjectGroupItem } from '@/lib/api'

export type ProjectSummary = ProjectGroupItem['projects'][number]
export type ActiveRenameTarget = { type: 'group'; id: number } | { type: 'project'; id: number }
export type DeleteTarget =
    | { type: 'group'; group: GroupWithProjects }
    | { type: 'project'; project: ProjectSummary }
export type ProjectDialog =
    | { type: 'create-group' }
    | { type: 'create-project'; group: GroupWithProjects | null }
    | { type: 'delete'; target: DeleteTarget }
    | null

export const projectDialogAtom = atom<ProjectDialog>(null)
export const renameTargetAtom = atom<ActiveRenameTarget | null>(null)
export const renameValueAtom = atom('')
export const activeProjectDragIdAtom = atom<number | null>(null)

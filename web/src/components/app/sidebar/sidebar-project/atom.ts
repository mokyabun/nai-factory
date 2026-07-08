import { atom } from 'jotai'
import type { GroupWithProjects, ProjectGroupItem } from '@/lib/api'

const COLLAPSED_GROUP_IDS_STORAGE_KEY = 'nai-factory.sidebar.project.collapsedGroupIds'

export type ProjectSummary = ProjectGroupItem['projects'][number]
export type ActiveRenameTarget = { type: 'group'; id: number } | { type: 'project'; id: number }
export type DeleteTarget =
    | { type: 'group'; group: GroupWithProjects }
    | { type: 'project'; project: ProjectSummary }
export type ProjectDialog =
    | { type: 'create-group'; group: GroupWithProjects | null }
    | { type: 'create-project'; group: GroupWithProjects | null }
    | { type: 'delete'; target: DeleteTarget }
    | null

export const projectDialogAtom = atom<ProjectDialog>(null)
export const renameTargetAtom = atom<ActiveRenameTarget | null>(null)
export const renameValueAtom = atom('')
export const activeProjectDragIdAtom = atom<number | null>(null)
export const activeGroupDragIdAtom = atom<number | null>(null)
export const collapsedGroupIdsAtom = atom(readCollapsedGroupIds())
export const setGroupCollapsedAtom = atom(
    null,
    (get, set, { groupId, collapsed }: { groupId: number; collapsed: boolean }) => {
        const next = new Set(get(collapsedGroupIdsAtom))
        if (collapsed) next.add(groupId)
        else next.delete(groupId)

        set(collapsedGroupIdsAtom, next)
        writeCollapsedGroupIds(next)
    },
)

function readCollapsedGroupIds() {
    if (typeof window === 'undefined') return new Set<number>()

    try {
        const value = window.localStorage.getItem(COLLAPSED_GROUP_IDS_STORAGE_KEY)
        if (!value) return new Set<number>()

        const parsed = JSON.parse(value)
        if (!Array.isArray(parsed)) return new Set<number>()

        return new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0))
    } catch {
        return new Set<number>()
    }
}

function writeCollapsedGroupIds(groupIds: Set<number>) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COLLAPSED_GROUP_IDS_STORAGE_KEY, JSON.stringify([...groupIds]))
}

import type { GroupNode, GroupTreeItem } from '@nai-factory/shared'

import type { ProjectSummary } from './project-tree-model'
import type { ProjectGroupId } from './project-tree-model'

/*
 * Pure updates of the cached group tree, used for optimistic UI while mutations are pending.
 */

export function collectGroupProjects(group: GroupNode): ProjectSummary[] {
    return [
        ...group.projects,
        ...group.groups.flatMap((childGroup) => collectGroupProjects(childGroup)),
    ]
}

export function addGroupToTree(
    items: GroupTreeItem[],
    parentId: ProjectGroupId,
    group: GroupNode,
): GroupTreeItem[] {
    if (parentId === null) {
        const ungrouped = items.find((item) => item.type === 'ungrouped')
        const rootGroups = items.filter((item): item is GroupNode => item.type === 'group')
        return ungrouped
            ? [ungrouped, ...sortGroups([...rootGroups, group])]
            : sortGroups([...rootGroups, group])
    }

    return items.map((item) =>
        item.type === 'group' ? addGroupToParent(item, parentId, group, () => undefined) : item,
    )
}

export function replaceGroupInTree(
    items: GroupTreeItem[],
    groupId: number,
    replacement: GroupNode,
): GroupTreeItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') return item
        if (item.id === groupId) return replacement
        return { ...item, groups: replaceGroupsInGroups(item.groups, groupId, replacement) }
    })
}

function replaceGroupsInGroups(
    groups: GroupNode[],
    groupId: number,
    replacement: GroupNode,
): GroupNode[] {
    return groups.map((group) => {
        if (group.id === groupId) return replacement
        return { ...group, groups: replaceGroupsInGroups(group.groups, groupId, replacement) }
    })
}

export function renameGroupInTree(
    items: GroupTreeItem[],
    groupId: number,
    name: string,
): GroupTreeItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') return item
        return renameGroup(item, groupId, name)
    })
}

function renameGroup(group: GroupNode, groupId: number, name: string): GroupNode {
    if (group.id === groupId) return { ...group, name }
    return {
        ...group,
        groups: group.groups.map((childGroup) => renameGroup(childGroup, groupId, name)),
    }
}

export function removeGroupFromItems(items: GroupTreeItem[], groupId: number): GroupTreeItem[] {
    return items.flatMap((item): GroupTreeItem[] => {
        if (item.type === 'ungrouped') return [item]
        if (item.id === groupId) return []
        return [{ ...item, groups: removeGroupFromGroups(item.groups, groupId, () => undefined) }]
    })
}

export function addProjectToTree(
    items: GroupTreeItem[],
    groupId: ProjectGroupId,
    project: ProjectSummary,
): GroupTreeItem[] {
    let inserted = false
    const nextItems = items.map((item) => {
        if (item.type === 'ungrouped') {
            if (groupId !== null) return item
            inserted = true
            return { ...item, projects: sortProjects([...item.projects, project]) }
        }

        return addProjectToGroup(item, groupId, project, () => {
            inserted = true
        })
    })

    if (groupId === null && !inserted) {
        return [
            { type: 'ungrouped' as const, id: null, name: '그룹 없음', projects: [project] },
            ...nextItems,
        ]
    }

    return nextItems
}

export function replaceProjectInTree(
    items: GroupTreeItem[],
    projectId: number,
    replacement: ProjectSummary,
): GroupTreeItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') {
            return {
                ...item,
                projects: sortProjects(
                    item.projects.map((project) =>
                        project.id === projectId ? replacement : project,
                    ),
                ),
            }
        }

        return replaceProjectInGroup(item, projectId, replacement)
    })
}

function replaceProjectInGroup(
    group: GroupNode,
    projectId: number,
    replacement: ProjectSummary,
): GroupNode {
    return {
        ...group,
        projects: sortProjects(
            group.projects.map((project) => (project.id === projectId ? replacement : project)),
        ),
        groups: group.groups.map((childGroup) =>
            replaceProjectInGroup(childGroup, projectId, replacement),
        ),
    }
}

export function removeProjectFromTree(items: GroupTreeItem[], projectId: number): GroupTreeItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') {
            return {
                ...item,
                projects: item.projects.filter((project) => project.id !== projectId),
            }
        }

        return removeProjectFromGroup(item, projectId, () => undefined)
    })
}

export function renameProjectInTree(
    items: GroupTreeItem[],
    projectId: number,
    name: string,
): GroupTreeItem[] {
    const project = findProjectInTree(items, projectId)
    if (!project) return items
    return replaceProjectInTree(items, projectId, { ...project, name })
}

export function findProjectInTree(
    items: GroupTreeItem[],
    projectId: number,
): ProjectSummary | null {
    for (const item of items) {
        const match = item.projects.find((project) => project.id === projectId)
        if (match) return match
        if (item.type === 'group') {
            const childMatch = findProjectInGroups(item.groups, projectId)
            if (childMatch) return childMatch
        }
    }

    return null
}

function findProjectInGroups(groups: GroupNode[], projectId: number): ProjectSummary | null {
    for (const group of groups) {
        const match = group.projects.find((project) => project.id === projectId)
        if (match) return match
        const childMatch = findProjectInGroups(group.groups, projectId)
        if (childMatch) return childMatch
    }

    return null
}

export function moveProjectInGroupTree(
    items: GroupTreeItem[],
    projectId: number,
    groupId: ProjectGroupId,
): GroupTreeItem[] {
    let projectToMove: ProjectSummary | null = null

    const withoutProject = items.map((item) => {
        if (item.type === 'ungrouped') {
            const projects = item.projects.filter((project) => {
                if (project.id !== projectId) return true
                projectToMove = project
                return false
            })

            return { ...item, projects }
        }

        return removeProjectFromGroup(item, projectId, (project) => {
            projectToMove = project
        })
    })

    const project = projectToMove
    if (!project) return items

    const movedProject: ProjectSummary = { ...(project as ProjectSummary), groupId }
    let inserted = false
    const movedItems = withoutProject.map((item) => {
        if (item.type === 'ungrouped') {
            if (groupId !== null) return item
            inserted = true
            return { ...item, projects: sortProjects([...item.projects, movedProject]) }
        }

        return addProjectToGroup(item, groupId, movedProject, () => {
            inserted = true
        })
    })

    if (groupId === null && !inserted) {
        return [
            { type: 'ungrouped' as const, id: null, name: '그룹 없음', projects: [movedProject] },
            ...movedItems,
        ]
    }

    if (!inserted) return items
    return movedItems.filter((item) => item.type !== 'ungrouped' || item.projects.length > 0)
}

function removeProjectFromGroup(
    group: GroupNode,
    projectId: number,
    onRemove: (project: ProjectSummary) => void,
): GroupNode {
    return {
        ...group,
        projects: group.projects.filter((project) => {
            if (project.id !== projectId) return true
            onRemove(project)
            return false
        }),
        groups: group.groups.map((childGroup) =>
            removeProjectFromGroup(childGroup, projectId, onRemove),
        ),
    }
}

function addProjectToGroup(
    group: GroupNode,
    groupId: ProjectGroupId,
    project: ProjectSummary,
    onInsert: () => void,
): GroupNode {
    if (group.id === groupId) {
        onInsert()
        return { ...group, projects: sortProjects([...group.projects, project]) }
    }

    return {
        ...group,
        groups: group.groups.map((childGroup) =>
            addProjectToGroup(childGroup, groupId, project, onInsert),
        ),
    }
}

export function moveGroupInGroupTree(
    items: GroupTreeItem[],
    groupId: number,
    parentId: ProjectGroupId,
): GroupTreeItem[] {
    const ungrouped = items.find((item) => item.type === 'ungrouped')
    const rootGroups = items.filter((item): item is GroupNode => item.type === 'group')
    let groupToMove: GroupNode | null = null
    const rootGroupsWithoutMoved = removeGroupFromGroups(rootGroups, groupId, (group) => {
        groupToMove = group
    })

    const group = groupToMove
    if (!group) return items

    const movedGroup: GroupNode = { ...(group as GroupNode), parentId }
    let inserted = false
    const nextRootGroups =
        parentId === null
            ? sortGroups([...rootGroupsWithoutMoved, movedGroup])
            : rootGroupsWithoutMoved.map((group) =>
                  addGroupToParent(group, parentId, movedGroup, () => {
                      inserted = true
                  }),
              )

    if (parentId !== null && !inserted) return items
    return ungrouped ? [ungrouped, ...nextRootGroups] : nextRootGroups
}

function removeGroupFromGroups(
    groups: GroupNode[],
    groupId: number,
    onRemove: (group: GroupNode) => void,
): GroupNode[] {
    return groups.flatMap((group) => {
        if (group.id === groupId) {
            onRemove(group)
            return []
        }

        return [
            {
                ...group,
                groups: removeGroupFromGroups(group.groups, groupId, onRemove),
            },
        ]
    })
}

function addGroupToParent(
    group: GroupNode,
    parentId: ProjectGroupId,
    groupToAdd: GroupNode,
    onInsert: () => void,
): GroupNode {
    if (group.id === parentId) {
        onInsert()
        return { ...group, groups: sortGroups([...group.groups, groupToAdd]) }
    }

    return {
        ...group,
        groups: group.groups.map((childGroup) =>
            addGroupToParent(childGroup, parentId, groupToAdd, onInsert),
        ),
    }
}

function sortProjects(projects: ProjectSummary[]) {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

function sortGroups(groups: GroupNode[]) {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

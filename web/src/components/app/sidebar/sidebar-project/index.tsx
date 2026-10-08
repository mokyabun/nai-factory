import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Provider, useAtom } from 'jotai'

import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId, ProjectGroupItem } from '@/lib/api'
import { api } from '@/lib/api'
import { requireApiResult, restoreSnapshot, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'

import {
    type ActiveRenameTarget,
    type ProjectSummary,
    projectDialogAtom,
    renameTargetAtom,
    renameValueAtom,
} from './atom'
import { ProjectDialogs } from './project-dialogs'
import { ProjectTree } from './project-tree'

export function SidebarProject() {
    return (
        <Provider>
            <SidebarProjectContent />
        </Provider>
    )
}

function SidebarProjectContent() {
    const navigate = useNavigate()
    const router = useRouter()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const queryClient = useQueryClient()

    const groupsQuery = useQuery({
        queryKey: qk.groupsWithProjects(),
        queryFn: async () => {
            const { data } = await api.groups.get()
            return data ?? []
        },
    })

    function invalidateGroups() {
        void queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
    }

    const createGroup = useMutation({
        mutationFn: ({ name, parentGroupId }: { name: string; parentGroupId: number | null }) =>
            requireApiResult(api.groups.post({ name, parentGroupId })),
        onMutate: async ({ name, parentGroupId }) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            const now = new Date().toISOString()
            const tempGroup: GroupWithProjects = {
                // eslint-disable-next-line react/purity -- Generate a temporary ID inside the mutation callback, outside render.
                id: -Date.now(),
                type: 'group',
                parentGroupId,
                name,
                createdAt: now,
                updatedAt: now,
                projects: [],
                groups: [],
            }
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? addGroupToTree(items, parentGroupId, tempGroup) : items,
            )
            setProjectDialog(null)
            return { previousGroups, tempId: tempGroup.id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (res, _variables, context) => {
            if (!res.data) return
            const group: GroupWithProjects = {
                ...res.data,
                type: 'group',
                projects: [],
                groups: [],
            }
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? replaceGroupInTree(items, context?.tempId ?? group.id, group) : items,
            )
        },
        onSettled: invalidateGroups,
    })

    const deleteGroup = useMutation({
        mutationFn: (id: number) => requireApiResult(api.groups({ id }).delete()),
        onMutate: async (id) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? removeGroupFromItems(items, id) : items,
            )
            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSettled: invalidateGroups,
    })

    const renameGroup = useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) =>
            requireApiResult(api.groups({ id }).patch({ name })),
        onMutate: async ({ id, name }) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? renameGroupInTree(items, id, name) : items,
            )
            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSettled: invalidateGroups,
    })

    const createProject = useMutation({
        mutationFn: ({ groupId, name }: { groupId: ProjectGroupId; name: string }) =>
            requireApiResult(api.projects.post({ groupId, name })),
        onMutate: async ({ groupId, name }) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            // eslint-disable-next-line react/purity -- Generate a temporary ID inside the mutation callback, outside render.
            const tempId = -Date.now()
            const tempProject: ProjectSummary = { id: tempId, groupId, name }
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? addProjectToTree(items, groupId, tempProject) : items,
            )
            setProjectDialog(null)
            return { previousGroups, tempId }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (res, _variables, context) => {
            const project = res.data
            if (!project) return
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? replaceProjectInTree(items, context?.tempId ?? project.id, project) : items,
            )
            queryClient.setQueryData(qk.project(project.id), project)
            selectProject(project)
        },
        onSettled: invalidateGroups,
    })

    const deleteProject = useMutation({
        mutationFn: (projectId: number) => requireApiResult(api.projects({ projectId }).delete()),
        onMutate: async (projectId) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? removeProjectFromTree(items, projectId) : items,
            )
            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSettled: invalidateGroups,
    })

    const renameProject = useMutation({
        mutationFn: ({ projectId, name }: { projectId: number; name: string }) =>
            requireApiResult(api.projects({ projectId }).patch({ name })),
        onMutate: async ({ projectId, name }) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? renameProjectInTree(items, projectId, name) : items,
            )
            queryClient.setQueryData(qk.project(projectId), (project) =>
                project ? { ...project, name } : project,
            )
            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSettled: invalidateGroups,
    })

    const moveProject = useMutation({
        mutationFn: ({ projectId, groupId }: { projectId: number; groupId: ProjectGroupId }) =>
            requireApiResult(api.projects({ projectId }).patch({ groupId })),
        onMutate: async ({ projectId, groupId }) => {
            await queryClient.cancelQueries({ queryKey: qk.groupsWithProjects() })
            const previousGroups = queryClient.getQueryData<ProjectGroupItem[]>(
                qk.groupsWithProjects(),
            )

            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? moveProjectInGroupTree(items, projectId, groupId) : items,
            )

            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousGroups) {
                queryClient.setQueryData(qk.groupsWithProjects(), context.previousGroups)
            }
        },
        onSettled: invalidateGroups,
    })

    const moveGroup = useMutation({
        mutationFn: ({
            groupId,
            parentGroupId,
        }: {
            groupId: number
            parentGroupId: ProjectGroupId
        }) => requireApiResult(api.groups({ id: groupId }).patch({ parentGroupId })),
        onMutate: async ({ groupId, parentGroupId }) => {
            await queryClient.cancelQueries({ queryKey: qk.groupsWithProjects() })
            const previousGroups = queryClient.getQueryData<ProjectGroupItem[]>(
                qk.groupsWithProjects(),
            )

            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? moveGroupInGroupTree(items, groupId, parentGroupId) : items,
            )

            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousGroups) {
                queryClient.setQueryData(qk.groupsWithProjects(), context.previousGroups)
            }
        },
        onSettled: invalidateGroups,
    })

    const duplicateProject = useMutation({
        mutationFn: (projectId: number) =>
            requireApiResult(api.projects({ projectId }).duplicate.post()),
        onMutate: async (projectId) => {
            const previousGroups = await snapshotQuery<ProjectGroupItem[]>(
                queryClient,
                qk.groupsWithProjects(),
            )
            const sourceProject = findProjectInTree(previousGroups.data ?? [], projectId)
            const tempId = -Date.now()
            if (sourceProject) {
                queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                    items
                        ? addProjectToTree(items, sourceProject.groupId, {
                              ...sourceProject,
                              id: tempId,
                              name: `${sourceProject.name} Copy`,
                          })
                        : items,
                )
            }
            return { previousGroups, tempId }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (res, _variables, context) => {
            const project = res.data
            if (!project) return
            queryClient.setQueryData<ProjectGroupItem[]>(qk.groupsWithProjects(), (items) =>
                items ? replaceProjectInTree(items, context?.tempId ?? project.id, project) : items,
            )
            queryClient.setQueryData(qk.project(project.id), project)
            selectProject(project)
        },
        onSettled: invalidateGroups,
    })

    const [projectDialog, setProjectDialog] = useAtom(projectDialogAtom)
    const [renameTarget, setRenameTarget] = useAtom(renameTargetAtom)
    const [renameValue, setRenameValue] = useAtom(renameValueAtom)
    const deleteTarget = projectDialog?.type === 'delete' ? projectDialog.target : null
    const createGroupParent =
        projectDialog?.type === 'create-group' ? projectDialog.group : undefined
    const createProjectGroup =
        projectDialog?.type === 'create-project' ? projectDialog.group : undefined

    const currentProjectId = getCurrentProjectId(pathname)

    function startRename(target: ActiveRenameTarget, name: string) {
        setRenameTarget(target)
        setRenameValue(name)
    }

    function cancelRename() {
        setRenameTarget(null)
    }

    async function commitRename(target: ActiveRenameTarget) {
        const name = renameValue.trim()

        if (!name) {
            cancelRename()
            return
        }

        if (target.type === 'group') {
            await renameGroup.mutateAsync({ id: target.id, name })
        } else {
            await renameProject.mutateAsync({ projectId: target.id, name })
        }

        cancelRename()
    }

    function selectProject(project: ProjectSummary) {
        void navigate({
            to: '/project/$projectId',
            params: { projectId: String(project.id) },
            search: (prev) => ({ ...prev, sidebar: 'prompt' }),
            replace: currentProjectId === project.id,
        })
    }

    function preloadProject(project: ProjectSummary) {
        const projectId = project.id

        router
            .preloadRoute({
                to: '/project/$projectId',
                params: { projectId: String(projectId) },
                search: (prev) => ({ ...prev, sidebar: 'prompt' }),
            })
            .catch(() => undefined)

        void queryClient.prefetchQuery({
            queryKey: qk.project(projectId),
            queryFn: async () => {
                const { data } = await api.projects({ projectId }).get()
                return data ?? null
            },
        })

        void queryClient.prefetchQuery({
            queryKey: qk.scenes(projectId),
            queryFn: async () => {
                const { data } = await api.scenes.get({ query: { projectId } })
                return data ?? []
            },
        })
    }

    async function handleDeleteGroup(group: GroupWithProjects) {
        await deleteGroup.mutateAsync(group.id)

        if (
            currentProjectId &&
            collectGroupProjects(group).some((project) => project.id === currentProjectId)
        ) {
            void navigate({ to: '/' })
        }
    }

    async function handleDeleteProject(project: ProjectSummary) {
        await deleteProject.mutateAsync(project.id)

        if (currentProjectId === project.id) {
            void navigate({ to: '/' })
        }
    }

    async function confirmDeleteTarget() {
        if (deleteTarget?.type === 'group') {
            await handleDeleteGroup(deleteTarget.group)
        } else if (deleteTarget?.type === 'project') {
            await handleDeleteProject(deleteTarget.project)
        }
    }

    return (
        <>
            <Base.SidebarContent>
                <ProjectTree
                    groups={groupsQuery.data ?? []}
                    isLoading={groupsQuery.isPending}
                    currentProjectId={currentProjectId}
                    rename={{ target: renameTarget, value: renameValue }}
                    onRenameValueChange={setRenameValue}
                    onCommitRename={commitRename}
                    onCancelRename={cancelRename}
                    actions={{
                        createGroup: (group) => setProjectDialog({ type: 'create-group', group }),
                        createProject: (group) =>
                            setProjectDialog({ type: 'create-project', group }),
                        renameGroup: (group) =>
                            startRename({ type: 'group', id: group.id }, group.name),
                        deleteGroup: (group) => {
                            setProjectDialog({
                                type: 'delete',
                                target: { type: 'group', group },
                            })
                        },
                        selectProject,
                        preloadProject,
                        renameProject: (project) =>
                            startRename({ type: 'project', id: project.id }, project.name),
                        duplicateProject: (project) => duplicateProject.mutate(project.id),
                        moveProject: (project, groupId) => {
                            if (project.groupId === groupId) return
                            moveProject.mutate({ projectId: project.id, groupId })
                        },
                        moveGroup: (group, parentGroupId) => {
                            if (group.parentGroupId === parentGroupId) return
                            moveGroup.mutate({ groupId: group.id, parentGroupId })
                        },
                        deleteProject: (project) => {
                            setProjectDialog({
                                type: 'delete',
                                target: { type: 'project', project },
                            })
                        },
                    }}
                />
            </Base.SidebarContent>

            <ProjectDialogs
                projectDialog={projectDialog}
                onOpenChange={(open) => {
                    if (!open) setProjectDialog(null)
                }}
                onCreateGroup={(name) =>
                    createGroup.mutate({ name, parentGroupId: createGroupParent?.id ?? null })
                }
                onCreateProject={(name) => {
                    if (projectDialog?.type !== 'create-project') return
                    createProject.mutate({ groupId: createProjectGroup?.id ?? null, name })
                }}
                onConfirmDelete={confirmDeleteTarget}
            />
        </>
    )
}

function collectGroupProjects(group: GroupWithProjects): ProjectSummary[] {
    return [
        ...group.projects,
        ...group.groups.flatMap((childGroup) => collectGroupProjects(childGroup)),
    ]
}

function addGroupToTree(
    items: ProjectGroupItem[],
    parentGroupId: ProjectGroupId,
    group: GroupWithProjects,
): ProjectGroupItem[] {
    if (parentGroupId === null) {
        const ungrouped = items.find((item) => item.type === 'ungrouped')
        const rootGroups = items.filter((item): item is GroupWithProjects => item.type === 'group')
        return ungrouped
            ? [ungrouped, ...sortGroups([...rootGroups, group])]
            : sortGroups([...rootGroups, group])
    }

    return items.map((item) =>
        item.type === 'group'
            ? addGroupToParent(item, parentGroupId, group, () => undefined)
            : item,
    )
}

function replaceGroupInTree(
    items: ProjectGroupItem[],
    groupId: number,
    replacement: GroupWithProjects,
): ProjectGroupItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') return item
        if (item.id === groupId) return replacement
        return { ...item, groups: replaceGroupsInGroups(item.groups, groupId, replacement) }
    })
}

function replaceGroupsInGroups(
    groups: GroupWithProjects[],
    groupId: number,
    replacement: GroupWithProjects,
): GroupWithProjects[] {
    return groups.map((group) => {
        if (group.id === groupId) return replacement
        return { ...group, groups: replaceGroupsInGroups(group.groups, groupId, replacement) }
    })
}

function renameGroupInTree(
    items: ProjectGroupItem[],
    groupId: number,
    name: string,
): ProjectGroupItem[] {
    return items.map((item) => {
        if (item.type === 'ungrouped') return item
        return renameGroup(item, groupId, name)
    })
}

function renameGroup(group: GroupWithProjects, groupId: number, name: string): GroupWithProjects {
    if (group.id === groupId) return { ...group, name }
    return {
        ...group,
        groups: group.groups.map((childGroup) => renameGroup(childGroup, groupId, name)),
    }
}

function removeGroupFromItems(items: ProjectGroupItem[], groupId: number): ProjectGroupItem[] {
    return items.flatMap((item): ProjectGroupItem[] => {
        if (item.type === 'ungrouped') return [item]
        if (item.id === groupId) return []
        return [{ ...item, groups: removeGroupFromGroups(item.groups, groupId, () => undefined) }]
    })
}

function addProjectToTree(
    items: ProjectGroupItem[],
    groupId: ProjectGroupId,
    project: ProjectSummary,
): ProjectGroupItem[] {
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

function replaceProjectInTree(
    items: ProjectGroupItem[],
    projectId: number,
    replacement: ProjectSummary,
): ProjectGroupItem[] {
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
    group: GroupWithProjects,
    projectId: number,
    replacement: ProjectSummary,
): GroupWithProjects {
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

function removeProjectFromTree(items: ProjectGroupItem[], projectId: number): ProjectGroupItem[] {
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

function renameProjectInTree(
    items: ProjectGroupItem[],
    projectId: number,
    name: string,
): ProjectGroupItem[] {
    const project = findProjectInTree(items, projectId)
    if (!project) return items
    return replaceProjectInTree(items, projectId, { ...project, name })
}

function findProjectInTree(items: ProjectGroupItem[], projectId: number): ProjectSummary | null {
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

function findProjectInGroups(
    groups: GroupWithProjects[],
    projectId: number,
): ProjectSummary | null {
    for (const group of groups) {
        const match = group.projects.find((project) => project.id === projectId)
        if (match) return match
        const childMatch = findProjectInGroups(group.groups, projectId)
        if (childMatch) return childMatch
    }

    return null
}

function moveProjectInGroupTree(
    items: ProjectGroupItem[],
    projectId: number,
    groupId: ProjectGroupId,
): ProjectGroupItem[] {
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
    group: GroupWithProjects,
    projectId: number,
    onRemove: (project: ProjectSummary) => void,
): GroupWithProjects {
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
    group: GroupWithProjects,
    groupId: ProjectGroupId,
    project: ProjectSummary,
    onInsert: () => void,
): GroupWithProjects {
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

function moveGroupInGroupTree(
    items: ProjectGroupItem[],
    groupId: number,
    parentGroupId: ProjectGroupId,
): ProjectGroupItem[] {
    const ungrouped = items.find((item) => item.type === 'ungrouped')
    const rootGroups = items.filter((item): item is GroupWithProjects => item.type === 'group')
    let groupToMove: GroupWithProjects | null = null
    const rootGroupsWithoutMoved = removeGroupFromGroups(rootGroups, groupId, (group) => {
        groupToMove = group
    })

    const group = groupToMove
    if (!group) return items

    const movedGroup: GroupWithProjects = { ...(group as GroupWithProjects), parentGroupId }
    let inserted = false
    const nextRootGroups =
        parentGroupId === null
            ? sortGroups([...rootGroupsWithoutMoved, movedGroup])
            : rootGroupsWithoutMoved.map((group) =>
                  addGroupToParent(group, parentGroupId, movedGroup, () => {
                      inserted = true
                  }),
              )

    if (parentGroupId !== null && !inserted) return items
    return ungrouped ? [ungrouped, ...nextRootGroups] : nextRootGroups
}

function removeGroupFromGroups(
    groups: GroupWithProjects[],
    groupId: number,
    onRemove: (group: GroupWithProjects) => void,
): GroupWithProjects[] {
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
    group: GroupWithProjects,
    parentGroupId: ProjectGroupId,
    groupToAdd: GroupWithProjects,
    onInsert: () => void,
): GroupWithProjects {
    if (group.id === parentGroupId) {
        onInsert()
        return { ...group, groups: sortGroups([...group.groups, groupToAdd]) }
    }

    return {
        ...group,
        groups: group.groups.map((childGroup) =>
            addGroupToParent(childGroup, parentGroupId, groupToAdd, onInsert),
        ),
    }
}

function sortProjects(projects: ProjectSummary[]) {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

function sortGroups(groups: GroupWithProjects[]) {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
}

function getCurrentProjectId(pathname: string) {
    const match = pathname.match(/^\/project\/([^/]+)/)
    if (!match) return null

    const projectId = Number(match[1])
    return Number.isFinite(projectId) ? projectId : null
}

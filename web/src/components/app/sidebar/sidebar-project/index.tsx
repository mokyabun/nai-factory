import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Provider, useAtom } from 'jotai'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId, ProjectGroupItem } from '@/lib/api'
import { api } from '@/lib/api'
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
        queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
    }

    const createGroup = useMutation({
        mutationFn: ({ name, parentGroupId }: { name: string; parentGroupId: number | null }) =>
            api.groups.post({ name, parentGroupId }),
        onSuccess: invalidateGroups,
    })

    const deleteGroup = useMutation({
        mutationFn: (id: number) => api.groups({ id }).delete(),
        onSuccess: invalidateGroups,
    })

    const renameGroup = useMutation({
        mutationFn: ({ id, name }: { id: number; name: string }) =>
            api.groups({ id }).patch({ name }),
        onSuccess: invalidateGroups,
    })

    const createProject = useMutation({
        mutationFn: ({ groupId, name }: { groupId: ProjectGroupId; name: string }) =>
            api.projects.post({ groupId, name }),
        onSuccess: (res) => {
            invalidateGroups()
            if (res.data) selectProject(res.data)
        },
    })

    const deleteProject = useMutation({
        mutationFn: (projectId: number) => api.projects({ projectId }).delete(),
        onSuccess: invalidateGroups,
    })

    const renameProject = useMutation({
        mutationFn: ({ projectId, name }: { projectId: number; name: string }) =>
            api.projects({ projectId }).patch({ name }),
        onSuccess: invalidateGroups,
    })

    const moveProject = useMutation({
        mutationFn: ({ projectId, groupId }: { projectId: number; groupId: ProjectGroupId }) =>
            api.projects({ projectId }).patch({ groupId }),
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
        }) => api.groups({ id: groupId }).patch({ parentGroupId }),
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
        mutationFn: (projectId: number) => api.projects({ projectId }).duplicate.post(),
        onSuccess: (res) => {
            invalidateGroups()
            if (res.data) selectProject(res.data)
        },
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
        navigate({
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

        queryClient.prefetchQuery({
            queryKey: qk.project(projectId),
            queryFn: async () => {
                const { data } = await api.projects({ projectId }).get()
                return data ?? null
            },
        })

        queryClient.prefetchQuery({
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
            navigate({ to: '/' })
        }
    }

    async function handleDeleteProject(project: ProjectSummary) {
        await deleteProject.mutateAsync(project.id)

        if (currentProjectId === project.id) {
            navigate({ to: '/' })
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Provider, useAtom } from 'jotai'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId } from '@/lib/api'
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
        mutationFn: (name: string) => api.groups.post({ name }),
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
        mutationFn: ({ groupId, name }: { groupId: number; name: string }) =>
            api.projects.post({ groupId, name }),
        onSuccess: invalidateGroups,
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
        onSuccess: invalidateGroups,
    })

    const duplicateProject = useMutation({
        mutationFn: (projectId: number) => api.projects({ projectId }).duplicate.post(),
        onSuccess: invalidateGroups,
    })

    const [projectDialog, setProjectDialog] = useAtom(projectDialogAtom)
    const [renameTarget, setRenameTarget] = useAtom(renameTargetAtom)
    const [renameValue, setRenameValue] = useAtom(renameValueAtom)
    const deleteTarget = projectDialog?.type === 'delete' ? projectDialog.target : null
    const createProjectGroup = projectDialog?.type === 'create-project' ? projectDialog.group : null

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

        if (currentProjectId && group.projects.some((project) => project.id === currentProjectId)) {
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
                        createGroup: () => setProjectDialog({ type: 'create-group' }),
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
                onCreateGroup={(name) => createGroup.mutate(name)}
                onCreateProject={(name) =>
                    createProjectGroup &&
                    createProject.mutate({ groupId: createProjectGroup.id, name })
                }
                onConfirmDelete={confirmDeleteTarget}
            />
        </>
    )
}

function getCurrentProjectId(pathname: string) {
    const match = pathname.match(/^\/project\/([^/]+)/)
    if (!match) return null

    const projectId = Number(match[1])
    return Number.isFinite(projectId) ? projectId : null
}

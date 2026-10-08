import type { GroupNode } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { Provider, useAtom } from 'jotai'

import * as Base from '@/components/ui/sidebar'
import { call, contract } from '@/lib/api'
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
import { collectGroupProjects, getCurrentProjectId } from './project-tree-cache'
import { useProjectTree } from './use-project-tree'

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
    const {
        groupsQuery,
        createGroup,
        deleteGroup,
        renameGroup,
        createProject,
        deleteProject,
        renameProject,
        moveProject,
        moveGroup,
        duplicateProject,
    } = useProjectTree({
        onSelectProject: (project) => selectProject(project),
        onDialogClose: () => setProjectDialog(null),
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
            queryKey: qk.projects.get(projectId),
            queryFn: () => call(contract.projects.get, { params: { id: projectId } }),
        })

        void queryClient.prefetchQuery({
            queryKey: qk.scenes.list(projectId),
            queryFn: () => call(contract.scenes.list, { query: { projectId } }),
        })
    }

    async function handleDeleteGroup(group: GroupNode) {
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
                        moveGroup: (group, parentId) => {
                            if (group.parentId === parentId) return
                            moveGroup.mutate({ groupId: group.id, parentId })
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
                    createGroup.mutate({ name, parentId: createGroupParent?.id ?? null })
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

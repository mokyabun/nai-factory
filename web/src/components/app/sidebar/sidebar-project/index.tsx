import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateGroupDialog } from '@/components/app/dialogs/create-group-dialog'
import { CreateProjectDialog } from '@/components/app/dialogs/create-project-dialog'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects } from '@/lib/api'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import {
    type ActiveRenameTarget,
    type ProjectSummary,
    ProjectTree,
    type RenameTarget,
} from './project-tree'

type DeleteTarget =
    | { type: 'group'; group: GroupWithProjects }
    | { type: 'project'; project: ProjectSummary }
    | null

export function SidebarProject() {
    const navigate = useNavigate()
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

    const duplicateProject = useMutation({
        mutationFn: (projectId: number) => api.projects({ projectId }).duplicate.post(),
        onSuccess: invalidateGroups,
    })

    const [createGroupOpen, setCreateGroupOpen] = useState(false)
    const [createProjectOpen, setCreateProjectOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [targetGroup, setTargetGroup] = useState<GroupWithProjects | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
    const [renameTarget, setRenameTarget] = useState<RenameTarget>(null)
    const [renameValue, setRenameValue] = useState('')

    const currentProjectId = getCurrentProjectId(pathname)

    function startRename(target: ActiveRenameTarget, name: string) {
        setRenameTarget(target)
        setRenameValue(name)
    }

    async function commitRename(target: ActiveRenameTarget) {
        const name = renameValue.trim()

        if (!name) {
            setRenameTarget(null)
            return
        }

        if (target.type === 'group') {
            await renameGroup.mutateAsync({ id: target.id, name })
        } else {
            await renameProject.mutateAsync({ projectId: target.id, name })
        }

        setRenameTarget(null)
    }

    function selectProject(project: ProjectSummary) {
        navigate({
            to: '/project/$projectId',
            params: { projectId: String(project.id) },
            search: (prev) => ({ ...prev, sidebar: 'prompt' }),
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

    function confirmDeleteTarget() {
        if (deleteTarget?.type === 'group') {
            handleDeleteGroup(deleteTarget.group)
        } else if (deleteTarget?.type === 'project') {
            handleDeleteProject(deleteTarget.project)
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
                    onCancelRename={() => setRenameTarget(null)}
                    actions={{
                        createGroup: () => setCreateGroupOpen(true),
                        createProject: (group) => {
                            setTargetGroup(group)
                            setCreateProjectOpen(true)
                        },
                        renameGroup: (group) =>
                            startRename({ type: 'group', id: group.id }, group.name),
                        deleteGroup: (group) => {
                            setDeleteTarget({ type: 'group', group })
                            setDeleteOpen(true)
                        },
                        selectProject,
                        renameProject: (project) =>
                            startRename({ type: 'project', id: project.id }, project.name),
                        duplicateProject: (project) => duplicateProject.mutate(project.id),
                        deleteProject: (project) => {
                            setDeleteTarget({ type: 'project', project })
                            setDeleteOpen(true)
                        },
                    }}
                />
            </Base.SidebarContent>

            <ProjectDialogs
                createGroupOpen={createGroupOpen}
                createProjectOpen={createProjectOpen}
                deleteOpen={deleteOpen}
                targetGroup={targetGroup}
                deleteTarget={deleteTarget}
                onCreateGroupOpenChange={setCreateGroupOpen}
                onCreateProjectOpenChange={setCreateProjectOpen}
                onDeleteOpenChange={setDeleteOpen}
                onCreateGroup={(name) => createGroup.mutate(name)}
                onCreateProject={(name) =>
                    targetGroup && createProject.mutate({ groupId: targetGroup.id, name })
                }
                onConfirmDelete={confirmDeleteTarget}
            />
        </>
    )
}

interface ProjectDialogsProps {
    createGroupOpen: boolean
    createProjectOpen: boolean
    deleteOpen: boolean
    targetGroup: GroupWithProjects | null
    deleteTarget: DeleteTarget
    onCreateGroupOpenChange: (open: boolean) => void
    onCreateProjectOpenChange: (open: boolean) => void
    onDeleteOpenChange: (open: boolean) => void
    onCreateGroup: (name: string) => void
    onCreateProject: (name: string) => void
    onConfirmDelete: () => void
}

function ProjectDialogs({
    createGroupOpen,
    createProjectOpen,
    deleteOpen,
    targetGroup,
    deleteTarget,
    onCreateGroupOpenChange,
    onCreateProjectOpenChange,
    onDeleteOpenChange,
    onCreateGroup,
    onCreateProject,
    onConfirmDelete,
}: ProjectDialogsProps) {
    return (
        <>
            <CreateGroupDialog
                open={createGroupOpen}
                onOpenChange={onCreateGroupOpenChange}
                onCreate={onCreateGroup}
            />
            <CreateProjectDialog
                open={createProjectOpen}
                onOpenChange={onCreateProjectOpenChange}
                groupName={targetGroup?.name}
                onCreate={onCreateProject}
            />
            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={onDeleteOpenChange}
                title={deleteTarget?.type === 'group' ? '그룹 삭제' : '프로젝트 삭제'}
                description={getDeleteDescription(deleteTarget)}
                onConfirm={onConfirmDelete}
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

function getDeleteDescription(deleteTarget: DeleteTarget) {
    if (!deleteTarget) return ''

    if (deleteTarget.type === 'group') {
        return `"${deleteTarget.group.name}" 그룹과 포함된 모든 프로젝트를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
    }

    return `"${deleteTarget.project.name}" 프로젝트와 모든 씬, 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
}

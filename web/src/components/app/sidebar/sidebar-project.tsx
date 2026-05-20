import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronRight, File, Folder, MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDeleteDialog } from '#/components/app/dialogs/confirm-delete-dialog'
import { CreateGroupDialog } from '#/components/app/dialogs/create-group-dialog'
import { CreateProjectDialog } from '#/components/app/dialogs/create-project-dialog'
import { Button } from '#/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import * as Base from '#/components/ui/sidebar'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'

type GroupData = { id: number; name: string; projects: { id: number; name: string }[] }

export function SidebarProject() {
    const navigate = useNavigate()
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const queryClient = useQueryClient()

    const groupsQuery = useQuery({
        queryKey: qk.groupsWithProjects(),
        queryFn: async () => {
            const { data } = await api.groups.get()
            return (data ?? []) as GroupData[]
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
    const [targetGroup, setTargetGroup] = useState<GroupData | null>(null)
    const [targetProject, setTargetProject] = useState<{ id: number; name: string } | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<{
        type: 'group' | 'project'
        name: string
    } | null>(null)
    const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null)
    const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null)
    const [renameValue, setRenameValue] = useState('')

    const currentProjectId = pathname.startsWith('/project/')
        ? Number(pathname.split('/')[2])
        : null

    async function handleDeleteGroup(group: GroupData) {
        await deleteGroup.mutateAsync(group.id)
        if (currentProjectId && group.projects.some((p) => p.id === currentProjectId)) {
            navigate({ to: '/' })
        }
    }

    async function handleDeleteProject(project: { id: number; name: string }) {
        await deleteProject.mutateAsync(project.id)
        if (currentProjectId === project.id) {
            navigate({ to: '/' })
        }
    }

    async function commitGroupRename() {
        if (!renamingGroupId || !renameValue.trim()) {
            setRenamingGroupId(null)
            return
        }
        await renameGroup.mutateAsync({ id: renamingGroupId, name: renameValue.trim() })
        setRenamingGroupId(null)
    }

    async function commitProjectRename() {
        if (!renamingProjectId || !renameValue.trim()) {
            setRenamingProjectId(null)
            return
        }
        await renameProject.mutateAsync({ projectId: renamingProjectId, name: renameValue.trim() })
        setRenamingProjectId(null)
    }

    const groups = groupsQuery.data ?? []

    return (
        <>
            <Base.SidebarContent>
                <Base.SidebarGroup>
                    <Base.SidebarGroupLabel className="flex items-center justify-between pr-1">
                        <span>프로젝트</span>
                        <button
                            type="button"
                            className="rounded p-0.5 hover:bg-sidebar-accent"
                            onClick={() => setCreateGroupOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </Base.SidebarGroupLabel>
                    <Base.SidebarGroupContent>
                        <Base.SidebarMenu>
                            {groupsQuery.isPending ? (
                                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                    불러오는 중...
                                </div>
                            ) : groups.length === 0 ? (
                                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                                    그룹이 없습니다
                                </div>
                            ) : (
                                groups.map((group) => (
                                    <Base.SidebarMenuItem key={group.id}>
                                        <Collapsible defaultOpen className="group/collapsible">
                                            <div className="flex items-center gap-0.5 pr-1">
                                                <CollapsibleTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent"
                                                    >
                                                        <ChevronRight className="chevron h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                                        <Folder className="h-3.5 w-3.5 shrink-0" />
                                                        {renamingGroupId === group.id ? (
                                                            <Input
                                                                className="h-5 flex-1 px-1 py-0 text-xs"
                                                                value={renameValue}
                                                                onChange={(e) =>
                                                                    setRenameValue(e.target.value)
                                                                }
                                                                onBlur={commitGroupRename}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter')
                                                                        commitGroupRename()
                                                                    if (e.key === 'Escape')
                                                                        setRenamingGroupId(null)
                                                                }}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <span className="truncate text-xs">
                                                                {group.name}
                                                            </span>
                                                        )}
                                                    </button>
                                                </CollapsibleTrigger>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 shrink-0 opacity-0 group-hover/collapsible:opacity-100"
                                                        >
                                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setTargetGroup(group)
                                                                setCreateProjectOpen(true)
                                                            }}
                                                        >
                                                            새 프로젝트
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setRenamingGroupId(group.id)
                                                                setRenameValue(group.name)
                                                            }}
                                                        >
                                                            이름 변경
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => {
                                                                setTargetGroup(group)
                                                                setDeleteTarget({
                                                                    type: 'group',
                                                                    name: group.name,
                                                                })
                                                                setDeleteOpen(true)
                                                            }}
                                                        >
                                                            삭제
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            <CollapsibleContent>
                                                <Base.SidebarMenuSub>
                                                    {group.projects.length === 0 ? (
                                                        <div className="py-1 pl-8 text-xs text-muted-foreground">
                                                            프로젝트 없음
                                                        </div>
                                                    ) : (
                                                        group.projects.map((project) => (
                                                            <Base.SidebarMenuSubItem
                                                                key={project.id}
                                                            >
                                                                <div className="group/project flex items-center gap-0.5 pr-1">
                                                                    {renamingProjectId ===
                                                                    project.id ? (
                                                                        <Input
                                                                            className="h-6 flex-1 px-1 py-0 text-xs"
                                                                            value={renameValue}
                                                                            onChange={(e) =>
                                                                                setRenameValue(
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                            onBlur={
                                                                                commitProjectRename
                                                                            }
                                                                            onKeyDown={(e) => {
                                                                                if (
                                                                                    e.key ===
                                                                                    'Enter'
                                                                                )
                                                                                    commitProjectRename()
                                                                                if (
                                                                                    e.key ===
                                                                                    'Escape'
                                                                                )
                                                                                    setRenamingProjectId(
                                                                                        null,
                                                                                    )
                                                                            }}
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <Base.SidebarMenuSubButton
                                                                            isActive={
                                                                                currentProjectId ===
                                                                                project.id
                                                                            }
                                                                            className="flex-1"
                                                                            onClick={() =>
                                                                                navigate({
                                                                                    to: '/project/$projectId',
                                                                                    params: {
                                                                                        projectId:
                                                                                            String(
                                                                                                project.id,
                                                                                            ),
                                                                                    },
                                                                                })
                                                                            }
                                                                        >
                                                                            <File className="h-3.5 w-3.5 shrink-0" />
                                                                            <span className="truncate">
                                                                                {project.name}
                                                                            </span>
                                                                        </Base.SidebarMenuSubButton>
                                                                    )}

                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger
                                                                            asChild
                                                                        >
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6 shrink-0 opacity-0 group-hover/project:opacity-100"
                                                                            >
                                                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="start">
                                                                            <DropdownMenuItem
                                                                                onClick={() => {
                                                                                    setRenamingProjectId(
                                                                                        project.id,
                                                                                    )
                                                                                    setRenameValue(
                                                                                        project.name,
                                                                                    )
                                                                                }}
                                                                            >
                                                                                이름 변경
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem
                                                                                onClick={() =>
                                                                                    duplicateProject.mutate(
                                                                                        project.id,
                                                                                    )
                                                                                }
                                                                            >
                                                                                복제
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => {
                                                                                    setTargetProject(
                                                                                        project,
                                                                                    )
                                                                                    setDeleteTarget(
                                                                                        {
                                                                                            type: 'project',
                                                                                            name: project.name,
                                                                                        },
                                                                                    )
                                                                                    setDeleteOpen(
                                                                                        true,
                                                                                    )
                                                                                }}
                                                                            >
                                                                                삭제
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </Base.SidebarMenuSubItem>
                                                        ))
                                                    )}
                                                </Base.SidebarMenuSub>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </Base.SidebarMenuItem>
                                ))
                            )}
                        </Base.SidebarMenu>
                    </Base.SidebarGroupContent>
                </Base.SidebarGroup>
            </Base.SidebarContent>

            <CreateGroupDialog
                open={createGroupOpen}
                onOpenChange={setCreateGroupOpen}
                onCreate={(name) => createGroup.mutate(name)}
            />
            <CreateProjectDialog
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
                groupName={targetGroup?.name}
                onCreate={(name) =>
                    targetGroup && createProject.mutate({ groupId: targetGroup.id, name })
                }
            />
            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={deleteTarget?.type === 'group' ? '그룹 삭제' : '프로젝트 삭제'}
                description={`"${deleteTarget?.name}" ${deleteTarget?.type === 'group' ? '그룹과 포함된 모든 프로젝트를 삭제합니다.' : '프로젝트와 모든 씬, 이미지를 삭제합니다.'} 이 작업은 되돌릴 수 없습니다.`}
                onConfirm={() => {
                    if (deleteTarget?.type === 'group' && targetGroup)
                        handleDeleteGroup(targetGroup)
                    else if (deleteTarget?.type === 'project' && targetProject)
                        handleDeleteProject(targetProject)
                }}
            />
        </>
    )
}

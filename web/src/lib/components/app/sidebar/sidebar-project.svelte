<script lang="ts">
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
    import FolderIcon from '@lucide/svelte/icons/folder'
    import FileIcon from '@lucide/svelte/icons/file'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'
    import * as Collapsible from '$lib/components/ui/collapsible'
    import * as Sidebar from '$lib/components/ui/sidebar'
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
    import { Button } from '$lib/components/ui/button'
    import { api } from '$lib/api'
    import { goto } from '$app/navigation'
    import { page } from '$app/state'
    import { selectedProject } from '$lib/states/selected-project.svelte'
    import CreateGroupDialog from '$lib/components/app/dialogs/create-group-dialog.svelte'
    import CreateProjectDialog from '$lib/components/app/dialogs/create-project-dialog.svelte'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import { Input } from '$lib/components/ui/input'
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { qk } from '$lib/queries'

    type Group = NonNullable<Awaited<ReturnType<typeof api.api.groups.get>>['data']>[number]
    type Project = NonNullable<
        Awaited<ReturnType<typeof api.api.projects.get>>['data']
    >[number]
    type GroupWithProjects = Group & { projects: Project[] }

    const queryClient = useQueryClient()

    const groupsQuery = createQuery(() => ({
        queryKey: qk.groupsWithProjects(),
        queryFn: async () => {
            const { data } = await api.api.groups.get()
            if (!data) return [] as GroupWithProjects[]
            return Promise.all(
                data.map(async (g) => {
                    const { data: projects } = await api.api.projects.get({
                        query: { groupId: g.id },
                    })
                    return { ...g, projects: projects ?? [] } as GroupWithProjects
                }),
            )
        },
    }))

    function invalidateGroups() {
        queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
    }

    const createGroup = createMutation(() => ({
        mutationFn: (name: string) => api.api.groups.post({ name }),
        onSuccess: invalidateGroups,
    }))

    const deleteGroup = createMutation(() => ({
        mutationFn: (id: number) => api.api.groups({ id }).delete(),
        onSuccess: invalidateGroups,
    }))

    const renameGroup = createMutation(() => ({
        mutationFn: ({ id, name }: { id: number; name: string }) =>
            api.api.groups({ id }).patch({ name }),
        onSuccess: invalidateGroups,
    }))

    const createProject = createMutation(() => ({
        mutationFn: ({ groupId, name }: { groupId: number; name: string }) =>
            api.api.projects.post({ groupId, name }),
        onSuccess: invalidateGroups,
    }))

    const deleteProject = createMutation(() => ({
        mutationFn: (projectId: number) => api.api.projects({ projectId }).delete(),
        onSuccess: invalidateGroups,
    }))

    const renameProject = createMutation(() => ({
        mutationFn: ({ projectId, name }: { projectId: number; name: string }) =>
            api.api.projects({ projectId }).patch({ name }),
        onSuccess: invalidateGroups,
    }))

    const duplicateProject = createMutation(() => ({
        mutationFn: (projectId: number) =>
            api.api.projects({ projectId }).duplicate.post(),
        onSuccess: invalidateGroups,
    }))

    // Dialogs
    let createGroupOpen = $state(false)
    let createProjectOpen = $state(false)
    let deleteOpen = $state(false)
    let targetGroup = $state<GroupWithProjects | null>(null)
    let targetProject = $state<Project | null>(null)
    let deleteTarget = $state<{ type: 'group' | 'project'; name: string } | null>(null)

    // Rename inline editing
    let renamingGroupId = $state<number | null>(null)
    let renamingProjectId = $state<number | null>(null)
    let renameValue = $state('')

    async function handleDeleteGroup(group: GroupWithProjects) {
        await deleteGroup.mutateAsync(group.id)
        if (selectedProject.id && group.projects.some((p) => p.id === selectedProject.id)) {
            selectedProject.id = null
        }
    }

    async function handleDeleteProject(project: Project) {
        await deleteProject.mutateAsync(project.id)
        if (selectedProject.id === project.id) {
            selectedProject.id = null
            goto('/')
        }
    }

    async function commitGroupRename() {
        if (!renamingGroupId || !renameValue.trim()) { renamingGroupId = null; return }
        await renameGroup.mutateAsync({ id: renamingGroupId, name: renameValue.trim() })
        renamingGroupId = null
    }

    async function commitProjectRename() {
        if (!renamingProjectId || !renameValue.trim()) { renamingProjectId = null; return }
        await renameProject.mutateAsync({ projectId: renamingProjectId, name: renameValue.trim() })
        renamingProjectId = null
    }

    let groups = $derived(groupsQuery.data ?? [])

    let currentProjectId = $derived(
        page.url.pathname.startsWith('/project/')
            ? Number(page.url.pathname.split('/')[2])
            : null,
    )
</script>

<Sidebar.Content>
    <Sidebar.Group>
        <Sidebar.GroupLabel class="flex items-center justify-between pr-1">
            <span>프로젝트</span>
            <button
                class="rounded p-0.5 hover:bg-sidebar-accent"
                onclick={() => (createGroupOpen = true)}
                title="새 그룹"
            >
                <PlusIcon class="h-3.5 w-3.5" />
            </button>
        </Sidebar.GroupLabel>
        <Sidebar.GroupContent>
            <Sidebar.Menu>
                {#if groupsQuery.isPending}
                    <div class="px-2 py-4 text-center text-xs text-muted-foreground">불러오는 중...</div>
                {:else if groups.length === 0}
                    <div class="px-2 py-4 text-center text-xs text-muted-foreground">
                        그룹이 없습니다
                    </div>
                {:else}
                    {#each groups as group (group.id)}
                        <Sidebar.MenuItem>
                            <Collapsible.Root
                                class="group/collapsible [&[data-state=open]>div>button>svg.chevron]:rotate-90"
                                open
                            >
                                <div class="flex items-center gap-0.5 pr-1">
                                    <Collapsible.Trigger class="flex flex-1 items-center gap-1">
                                        {#snippet child({ props })}
                                            <button
                                                {...props}
                                                class="flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent"
                                            >
                                                <ChevronRightIcon
                                                    class="chevron h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                                                />
                                                <FolderIcon class="h-3.5 w-3.5 shrink-0" />
                                                {#if renamingGroupId === group.id}
                                                    <Input
                                                        class="h-5 flex-1 px-1 py-0 text-xs"
                                                        value={renameValue}
                                                        oninput={(e) => (renameValue = (e.target as HTMLInputElement).value)}
                                                        onblur={commitGroupRename}
                                                        onkeydown={(e) => {
                                                            if (e.key === 'Enter') commitGroupRename()
                                                            if (e.key === 'Escape') renamingGroupId = null
                                                        }}
                                                        autofocus
                                                        onclick={(e) => e.stopPropagation()}
                                                    />
                                                {:else}
                                                    <span class="truncate text-xs">{group.name}</span>
                                                {/if}
                                            </button>
                                        {/snippet}
                                    </Collapsible.Trigger>

                                    <DropdownMenu.Root>
                                        <DropdownMenu.Trigger>
                                            {#snippet child({ props })}
                                                <Button
                                                    {...props}
                                                    variant="ghost"
                                                    size="icon"
                                                    class="h-6 w-6 shrink-0 opacity-0 group-hover/collapsible:opacity-100"
                                                >
                                                    <MoreHorizontalIcon class="h-3.5 w-3.5" />
                                                </Button>
                                            {/snippet}
                                        </DropdownMenu.Trigger>
                                        <DropdownMenu.Content align="start">
                                            <DropdownMenu.Item
                                                onclick={() => {
                                                    targetGroup = group
                                                    createProjectOpen = true
                                                }}
                                            >
                                                새 프로젝트
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Item
                                                onclick={() => {
                                                    renamingGroupId = group.id
                                                    renameValue = group.name
                                                }}
                                            >
                                                이름 변경
                                            </DropdownMenu.Item>
                                            <DropdownMenu.Separator />
                                            <DropdownMenu.Item
                                                class="text-destructive"
                                                onclick={() => {
                                                    deleteTarget = { type: 'group', name: group.name }
                                                    deleteOpen = true
                                                }}
                                            >
                                                삭제
                                            </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                    </DropdownMenu.Root>
                                </div>

                                <Collapsible.Content>
                                    <Sidebar.MenuSub>
                                        {#each group.projects as project (project.id)}
                                            <Sidebar.MenuSubItem>
                                                <div class="group/project flex items-center gap-0.5 pr-1">
                                                    {#if renamingProjectId === project.id}
                                                        <Input
                                                            class="h-6 flex-1 px-1 py-0 text-xs"
                                                            value={renameValue}
                                                            oninput={(e) => (renameValue = (e.target as HTMLInputElement).value)}
                                                            onblur={commitProjectRename}
                                                            onkeydown={(e) => {
                                                                if (e.key === 'Enter') commitProjectRename()
                                                                if (e.key === 'Escape') renamingProjectId = null
                                                            }}
                                                            autofocus
                                                        />
                                                    {:else}
                                                        <Sidebar.MenuSubButton
                                                            isActive={currentProjectId === project.id}
                                                            class="flex-1"
                                                            onclick={() => {
                                                                selectedProject.id = project.id
                                                                goto(`/project/${project.id}`)
                                                            }}
                                                        >
                                                            <FileIcon class="h-3.5 w-3.5 shrink-0" />
                                                            <span class="truncate">{project.name}</span>
                                                        </Sidebar.MenuSubButton>
                                                    {/if}

                                                    <DropdownMenu.Root>
                                                        <DropdownMenu.Trigger>
                                                            {#snippet child({ props })}
                                                                <Button
                                                                    {...props}
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    class="h-6 w-6 shrink-0 opacity-0 group-hover/project:opacity-100"
                                                                >
                                                                    <MoreHorizontalIcon
                                                                        class="h-3.5 w-3.5"
                                                                    />
                                                                </Button>
                                                            {/snippet}
                                                        </DropdownMenu.Trigger>
                                                        <DropdownMenu.Content align="start">
                                                            <DropdownMenu.Item
                                                                onclick={() => {
                                                                    renamingProjectId = project.id
                                                                    renameValue = project.name
                                                                }}
                                                            >
                                                                이름 변경
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Item
                                                                onclick={() => duplicateProject.mutate(project.id)}
                                                            >
                                                                복제
                                                            </DropdownMenu.Item>
                                                            <DropdownMenu.Separator />
                                                            <DropdownMenu.Item
                                                                class="text-destructive"
                                                                onclick={() => {
                                                                    targetProject = project
                                                                    deleteTarget = {
                                                                        type: 'project',
                                                                        name: project.name,
                                                                    }
                                                                    deleteOpen = true
                                                                }}
                                                            >
                                                                삭제
                                                            </DropdownMenu.Item>
                                                        </DropdownMenu.Content>
                                                    </DropdownMenu.Root>
                                                </div>
                                            </Sidebar.MenuSubItem>
                                        {:else}
                                            <div class="py-1 pl-8 text-xs text-muted-foreground">
                                                프로젝트 없음
                                            </div>
                                        {/each}
                                    </Sidebar.MenuSub>
                                </Collapsible.Content>
                            </Collapsible.Root>
                        </Sidebar.MenuItem>
                    {/each}
                {/if}
            </Sidebar.Menu>
        </Sidebar.GroupContent>
    </Sidebar.Group>
</Sidebar.Content>

<!-- Dialogs -->
<CreateGroupDialog
    bind:open={createGroupOpen}
    oncreate={(name) => createGroup.mutate(name)}
/>

<CreateProjectDialog
    bind:open={createProjectOpen}
    groupName={targetGroup?.name}
    oncreate={(name) => targetGroup && createProject.mutate({ groupId: targetGroup.id, name })}
/>

<ConfirmDeleteDialog
    bind:open={deleteOpen}
    title={deleteTarget?.type === 'group' ? '그룹 삭제' : '프로젝트 삭제'}
    description={`"${deleteTarget?.name}" ${deleteTarget?.type === 'group' ? '그룹과 포함된 모든 프로젝트를 삭제합니다.' : '프로젝트와 모든 씬, 이미지를 삭제합니다.'} 이 작업은 되돌릴 수 없습니다.`}
    onconfirm={() => {
        if (deleteTarget?.type === 'group' && targetGroup) handleDeleteGroup(targetGroup)
        else if (deleteTarget?.type === 'project' && targetProject) handleDeleteProject(targetProject)
    }}
/>

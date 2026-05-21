<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { CaretRight, DotsThree, File, Folder, Plus } from 'phosphor-svelte'
import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
import CreateNameDialog from '$lib/components/app/dialogs/create-name-dialog.svelte'
import { Button } from '$lib/components/ui/button'
import * as Collapsible from '$lib/components/ui/collapsible'
import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
import { Input } from '$lib/components/ui/input'
import * as Sidebar from '$lib/components/ui/sidebar'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'
import type { GroupData } from '$lib/types'

const queryClient = useQueryClient()

const groupsQuery = createQuery(() => ({
    queryKey: qk.groupsWithProjects(),
    queryFn: async () => {
        const { data } = await api.groups.get()
        return (data ?? []) as GroupData[]
    },
}))

const currentProjectId = $derived(
    page.url.pathname.startsWith('/project/') ? Number(page.url.pathname.split('/')[2]) : null,
)
const groups = $derived(groupsQuery.data ?? [])

let createGroupOpen = $state(false)
let createProjectOpen = $state(false)
let deleteOpen = $state(false)
let targetGroup = $state<GroupData | null>(null)
let targetProject = $state<{ id: number; name: string } | null>(null)
let deleteTarget = $state<{ type: 'group' | 'project'; name: string } | null>(null)
let renamingGroupId = $state<number | null>(null)
let renamingProjectId = $state<number | null>(null)
let renameValue = $state('')

function invalidateGroups() {
    queryClient.invalidateQueries({ queryKey: qk.groupsWithProjects() })
}

const createGroup = createMutation(() => ({
    mutationFn: (name: string) => api.groups.post({ name }),
    onSuccess: invalidateGroups,
}))
const deleteGroup = createMutation(() => ({
    mutationFn: (id: number) => api.groups({ id }).delete(),
    onSuccess: invalidateGroups,
}))
const renameGroup = createMutation(() => ({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.groups({ id }).patch({ name }),
    onSuccess: invalidateGroups,
}))
const createProject = createMutation(() => ({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) =>
        api.projects.post({ groupId, name }),
    onSuccess: invalidateGroups,
}))
const deleteProject = createMutation(() => ({
    mutationFn: (projectId: number) => api.projects({ projectId }).delete(),
    onSuccess: invalidateGroups,
}))
const renameProject = createMutation(() => ({
    mutationFn: ({ projectId, name }: { projectId: number; name: string }) =>
        api.projects({ projectId }).patch({ name }),
    onSuccess: invalidateGroups,
}))
const duplicateProject = createMutation(() => ({
    mutationFn: (projectId: number) => api.projects({ projectId }).duplicate.post(),
    onSuccess: invalidateGroups,
}))

async function handleDeleteGroup(group: GroupData) {
    await deleteGroup.mutateAsync(group.id)
    if (currentProjectId && group.projects.some((project) => project.id === currentProjectId)) {
        goto('/')
    }
}

async function handleDeleteProject(project: { id: number; name: string }) {
    await deleteProject.mutateAsync(project.id)
    if (currentProjectId === project.id) goto('/')
}

async function commitGroupRename() {
    if (!renamingGroupId || !renameValue.trim()) {
        renamingGroupId = null
        return
    }
    await renameGroup.mutateAsync({ id: renamingGroupId, name: renameValue.trim() })
    renamingGroupId = null
}

async function commitProjectRename() {
    if (!renamingProjectId || !renameValue.trim()) {
        renamingProjectId = null
        return
    }
    await renameProject.mutateAsync({
        projectId: renamingProjectId,
        name: renameValue.trim(),
    })
    renamingProjectId = null
}
</script>

<Sidebar.Content>
	<Sidebar.Group>
		<Sidebar.GroupLabel class="flex items-center justify-between pr-1">
			<span>프로젝트</span>
			<Button variant="ghost" size="icon-xs" onclick={() => (createGroupOpen = true)}>
				<Plus class="h-3.5 w-3.5" />
			</Button>
		</Sidebar.GroupLabel>
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#if groupsQuery.isPending}
					<div class="px-2 py-4 text-center text-xs text-muted-foreground">불러오는 중...</div>
				{:else if groups.length === 0}
					<div class="px-2 py-4 text-center text-xs text-muted-foreground">그룹이 없습니다</div>
				{:else}
					{#each groups as group (group.id)}
						<Sidebar.MenuItem>
							<Collapsible.Root open>
								<div class="group/collapsible flex items-center gap-0.5 pr-1">
									<Collapsible.Trigger
										class="flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent"
									>
										<CaretRight
											class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90"
										/>
										<Folder class="h-3.5 w-3.5 shrink-0" />
										{#if renamingGroupId === group.id}
											<Input
												class="h-5 flex-1 px-1 py-0 text-xs"
												bind:value={renameValue}
												onblur={commitGroupRename}
												onkeydown={(event) => {
													if (event.key === 'Enter') commitGroupRename()
													if (event.key === 'Escape') renamingGroupId = null
												}}
												onclick={(event) => event.stopPropagation()}
												autofocus
											/>
										{:else}
											<span class="truncate text-xs">{group.name}</span>
										{/if}
									</Collapsible.Trigger>

									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-0 group-hover/collapsible:opacity-100"
										>
											<DotsThree class="h-3.5 w-3.5" />
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
												class="text-destructive focus:text-destructive"
												onclick={() => {
													targetGroup = group
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
										{#if group.projects.length === 0}
											<div class="py-1 pl-8 text-xs text-muted-foreground">프로젝트 없음</div>
										{:else}
											{#each group.projects as project (project.id)}
												<Sidebar.MenuSubItem>
													<div class="group/project flex items-center gap-0.5 pr-1">
														{#if renamingProjectId === project.id}
															<Input
																class="h-6 flex-1 px-1 py-0 text-xs"
																bind:value={renameValue}
																onblur={commitProjectRename}
																onkeydown={(event) => {
																	if (event.key === 'Enter') commitProjectRename()
																	if (event.key === 'Escape') renamingProjectId = null
																}}
																autofocus
															/>
														{:else}
															<Sidebar.MenuSubButton
																isActive={currentProjectId === project.id}
																class="flex-1"
																href={`/project/${project.id}`}
															>
																<File class="h-3.5 w-3.5 shrink-0" />
																<span class="truncate">{project.name}</span>
															</Sidebar.MenuSubButton>
														{/if}

														<DropdownMenu.Root>
															<DropdownMenu.Trigger
																class="inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-0 group-hover/project:opacity-100"
															>
																<DotsThree class="h-3.5 w-3.5" />
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
																<DropdownMenu.Item onclick={() => duplicateProject.mutate(project.id)}>
																	복제
																</DropdownMenu.Item>
																<DropdownMenu.Separator />
																<DropdownMenu.Item
																	class="text-destructive focus:text-destructive"
																	onclick={() => {
																		targetProject = project
																		deleteTarget = { type: 'project', name: project.name }
																		deleteOpen = true
																	}}
																>
																	삭제
																</DropdownMenu.Item>
															</DropdownMenu.Content>
														</DropdownMenu.Root>
													</div>
												</Sidebar.MenuSubItem>
											{/each}
										{/if}
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

<CreateNameDialog
	bind:open={createGroupOpen}
	title="새 그룹"
	placeholder="그룹 이름..."
	onCreate={(name) => createGroup.mutate(name)}
/>
<CreateNameDialog
	bind:open={createProjectOpen}
	title="새 프로젝트"
	description={targetGroup ? `${targetGroup.name} 그룹에 추가` : undefined}
	placeholder="프로젝트 이름..."
	onCreate={(name) => targetGroup && createProject.mutate({ groupId: targetGroup.id, name })}
/>
<ConfirmDeleteDialog
	bind:open={deleteOpen}
	title={deleteTarget?.type === 'group' ? '그룹 삭제' : '프로젝트 삭제'}
	description={`"${deleteTarget?.name}" ${
		deleteTarget?.type === 'group'
			? '그룹과 포함된 모든 프로젝트를 삭제합니다.'
			: '프로젝트와 모든 씬, 이미지를 삭제합니다.'
	} 이 작업은 되돌릴 수 없습니다.`}
	onConfirm={() => {
		if (deleteTarget?.type === 'group' && targetGroup) handleDeleteGroup(targetGroup)
		else if (deleteTarget?.type === 'project' && targetProject) handleDeleteProject(targetProject)
	}}
/>

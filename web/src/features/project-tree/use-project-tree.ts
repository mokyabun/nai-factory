import type { GroupNode, GroupTreeItem, Project } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { restoreSnapshot, snapshotQuery, tempId } from '@/lib/optimistic'
import { qk, queries } from '@/lib/queries'

import {
    addGroupToTree,
    addProjectToTree,
    findProjectInTree,
    moveGroupInGroupTree,
    moveProjectInGroupTree,
    removeGroupFromItems,
    removeProjectFromTree,
    renameGroupInTree,
    renameProjectInTree,
    replaceGroupInTree,
    replaceProjectInTree,
} from './project-tree-cache'
import type { ProjectSummary } from './project-tree-model'
import type { ProjectGroupId } from './project-tree-model'

export function useProjectTree({
    onSelectProject,
    onDialogClose,
}: {
    onSelectProject: (project: ProjectSummary) => void
    onDialogClose: () => void
}) {
    const queryClient = useQueryClient()

    const groupsQuery = useQuery(queries.groups.tree())

    function invalidateGroups() {
        void queryClient.invalidateQueries({ queryKey: qk.groups.all() })
    }

    const createGroup = useMutation({
        mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
            call(contract.groups.create, { body: { name, parentId } }),
        onMutate: async ({ name, parentId }) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            const now = new Date().toISOString()
            const tempGroup: GroupNode = {
                id: tempId(),
                type: 'group',
                parentId,
                name,
                createdAt: now,
                updatedAt: now,
                projects: [],
                groups: [],
            }
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? addGroupToTree(items, parentId, tempGroup) : items,
            )
            onDialogClose()
            return { previousGroups, tempId: tempGroup.id }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (created, _variables, context) => {
            const group: GroupNode = {
                ...created,
                type: 'group',
                projects: [],
                groups: [],
            }
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? replaceGroupInTree(items, context?.tempId ?? group.id, group) : items,
            )
        },
        onSettled: invalidateGroups,
    })

    const deleteGroup = useMutation({
        mutationFn: (id: number) => call(contract.groups.delete, { params: { id } }),
        onMutate: async (id) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
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
            call(contract.groups.update, { params: { id }, body: { name } }),
        onMutate: async ({ id, name }) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
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
            call(contract.projects.create, { body: { groupId, name } }),
        onMutate: async ({ groupId, name }) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            const placeholderId = tempId()
            const tempProject: ProjectSummary = { id: placeholderId, groupId, name }
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? addProjectToTree(items, groupId, tempProject) : items,
            )
            onDialogClose()
            return { previousGroups, tempId: placeholderId }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (project, _variables, context) => {
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? replaceProjectInTree(items, context?.tempId ?? project.id, project) : items,
            )
            queryClient.setQueryData(qk.projects.get(project.id), project)
            onSelectProject(project)
        },
        onSettled: invalidateGroups,
    })

    const deleteProject = useMutation({
        mutationFn: (projectId: number) =>
            call(contract.projects.delete, { params: { id: projectId } }),
        onMutate: async (projectId) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
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
            call(contract.projects.update, { params: { id: projectId }, body: { name } }),
        onMutate: async ({ projectId, name }) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? renameProjectInTree(items, projectId, name) : items,
            )
            queryClient.setQueryData<Project>(qk.projects.get(projectId), (project) =>
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
            call(contract.projects.update, { params: { id: projectId }, body: { groupId } }),
        onMutate: async ({ projectId, groupId }) => {
            await queryClient.cancelQueries({ queryKey: qk.groups.tree() })
            const previousGroups = queryClient.getQueryData<GroupTreeItem[]>(qk.groups.tree())

            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? moveProjectInGroupTree(items, projectId, groupId) : items,
            )

            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousGroups) {
                queryClient.setQueryData(qk.groups.tree(), context.previousGroups)
            }
        },
        onSettled: invalidateGroups,
    })

    const moveGroup = useMutation({
        mutationFn: ({ groupId, parentId }: { groupId: number; parentId: ProjectGroupId }) =>
            call(contract.groups.update, { params: { id: groupId }, body: { parentId } }),
        onMutate: async ({ groupId, parentId }) => {
            await queryClient.cancelQueries({ queryKey: qk.groups.tree() })
            const previousGroups = queryClient.getQueryData<GroupTreeItem[]>(qk.groups.tree())

            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? moveGroupInGroupTree(items, groupId, parentId) : items,
            )

            return { previousGroups }
        },
        onError: (_error, _variables, context) => {
            if (context?.previousGroups) {
                queryClient.setQueryData(qk.groups.tree(), context.previousGroups)
            }
        },
        onSettled: invalidateGroups,
    })

    const duplicateProject = useMutation({
        mutationFn: (projectId: number) =>
            call(contract.projects.duplicate, { params: { id: projectId }, body: {} }),
        onMutate: async (projectId) => {
            const previousGroups = await snapshotQuery<GroupTreeItem[]>(
                queryClient,
                qk.groups.tree(),
            )
            const sourceProject = findProjectInTree(previousGroups.data ?? [], projectId)
            const placeholderId = tempId()
            if (sourceProject) {
                queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                    items
                        ? addProjectToTree(items, sourceProject.groupId, {
                              ...sourceProject,
                              id: placeholderId,
                              name: `${sourceProject.name} Copy`,
                          })
                        : items,
                )
            }
            return { previousGroups, tempId: placeholderId }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshot(queryClient, context?.previousGroups)
        },
        onSuccess: (project, _variables, context) => {
            queryClient.setQueryData<GroupTreeItem[]>(qk.groups.tree(), (items) =>
                items ? replaceProjectInTree(items, context?.tempId ?? project.id, project) : items,
            )
            queryClient.setQueryData(qk.projects.get(project.id), project)
            onSelectProject(project)
        },
        onSettled: invalidateGroups,
    })

    return {
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
    }
}

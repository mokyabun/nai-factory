import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateGroupDialog } from '@/components/app/dialogs/create-group-dialog'
import { CreateProjectDialog } from '@/components/app/dialogs/create-project-dialog'
import type { GroupWithProjects } from '@/lib/api'
import type { DeleteTarget, ProjectDialog } from './atom'

interface ProjectDialogsProps {
    projectDialog: ProjectDialog
    onOpenChange: (open: boolean) => void
    onCreateGroup: (name: string) => void
    onCreateProject: (name: string) => void
    onConfirmDelete: () => Promise<void> | void
}

export function ProjectDialogs({
    projectDialog,
    onOpenChange,
    onCreateGroup,
    onCreateProject,
    onConfirmDelete,
}: ProjectDialogsProps) {
    const createGroupParent = projectDialog?.type === 'create-group' ? projectDialog.group : null
    const createProjectGroup = projectDialog?.type === 'create-project' ? projectDialog.group : null
    const deleteTarget = projectDialog?.type === 'delete' ? projectDialog.target : null

    return (
        <>
            <CreateGroupDialog
                open={projectDialog?.type === 'create-group'}
                onOpenChange={onOpenChange}
                parentGroupName={createGroupParent?.name}
                onCreate={onCreateGroup}
            />
            <CreateProjectDialog
                open={projectDialog?.type === 'create-project'}
                onOpenChange={onOpenChange}
                groupName={createProjectGroup?.name}
                onCreate={onCreateProject}
            />
            <ConfirmDeleteDialog
                open={projectDialog?.type === 'delete'}
                onOpenChange={onOpenChange}
                title={deleteTarget?.type === 'group' ? '그룹 삭제' : '프로젝트 삭제'}
                description={getDeleteDescription(deleteTarget)}
                onConfirm={onConfirmDelete}
            />
        </>
    )
}

function getDeleteDescription(deleteTarget: DeleteTarget | null) {
    if (!deleteTarget) return ''

    if (deleteTarget.type === 'group') {
        const childGroupCount = countDescendantGroups(deleteTarget.group)
        const projectCount = countProjects(deleteTarget.group)
        const detail =
            childGroupCount > 0
                ? `하위 그룹 ${childGroupCount}개와 프로젝트 ${projectCount}개`
                : `프로젝트 ${projectCount}개`

        return `"${deleteTarget.group.name}" 그룹과 포함된 ${detail}를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
    }

    return `"${deleteTarget.project.name}" 프로젝트와 모든 씬, 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
}

function countDescendantGroups(group: GroupWithProjects): number {
    return group.groups.reduce((count, child) => count + 1 + countDescendantGroups(child), 0)
}

function countProjects(group: GroupWithProjects): number {
    return group.groups.reduce(
        (count, child) => count + countProjects(child),
        group.projects.length,
    )
}

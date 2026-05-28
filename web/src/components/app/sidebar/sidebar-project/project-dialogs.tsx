import { ConfirmDeleteDialog } from '@/components/app/dialogs/confirm-delete-dialog'
import { CreateGroupDialog } from '@/components/app/dialogs/create-group-dialog'
import { CreateProjectDialog } from '@/components/app/dialogs/create-project-dialog'
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
    const createProjectGroup = projectDialog?.type === 'create-project' ? projectDialog.group : null
    const deleteTarget = projectDialog?.type === 'delete' ? projectDialog.target : null

    return (
        <>
            <CreateGroupDialog
                open={projectDialog?.type === 'create-group'}
                onOpenChange={onOpenChange}
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
        return `"${deleteTarget.group.name}" 그룹과 포함된 모든 프로젝트를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
    }

    return `"${deleteTarget.project.name}" 프로젝트와 모든 씬, 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
}

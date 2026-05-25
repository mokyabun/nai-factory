import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
    closestCenter,
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, File, Folder, MoreHorizontal, Plus } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import * as Base from '@/components/ui/sidebar'
import type { GroupWithProjects, ProjectGroupId, ProjectGroupItem } from '@/lib/api'
import { cn } from '@/lib/utils'

export type ProjectSummary = ProjectGroupItem['projects'][number]

export type ActiveRenameTarget = { type: 'group'; id: number } | { type: 'project'; id: number }

export type RenameTarget = ActiveRenameTarget | null

interface RenameState {
    target: RenameTarget
    value: string
}

interface ProjectTreeActions {
    createGroup: () => void
    createProject: (group: GroupWithProjects) => void
    renameGroup: (group: GroupWithProjects) => void
    deleteGroup: (group: GroupWithProjects) => void
    selectProject: (project: ProjectSummary) => void
    renameProject: (project: ProjectSummary) => void
    duplicateProject: (project: ProjectSummary) => void
    moveProject: (project: ProjectSummary, groupId: ProjectGroupId) => void
    deleteProject: (project: ProjectSummary) => void
}

interface ProjectTreeProps {
    groups: ProjectGroupItem[]
    isLoading: boolean
    currentProjectId: number | null
    rename: RenameState
    actions: ProjectTreeActions
    onRenameValueChange: (value: string) => void
    onCommitRename: (target: ActiveRenameTarget) => void
    onCancelRename: () => void
}

export function ProjectTree({
    groups,
    isLoading,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: ProjectTreeProps) {
    const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
    const groupItems = useMemo(
        () => groups.filter((group): group is GroupWithProjects => group.type === 'group'),
        [groups],
    )
    const ungroupedProjects = useMemo(
        () => groups.find((group) => group.type === 'ungrouped')?.projects ?? [],
        [groups],
    )
    const activeProject = useMemo(
        () =>
            activeProjectId === null
                ? null
                : (groups
                      .flatMap((group) => group.projects)
                      .find((project) => project.id === activeProjectId) ?? null),
        [activeProjectId, groups],
    )

    function handleDragStart(event: DragStartEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        setActiveProjectId(project?.id ?? null)
    }

    function handleDragEnd(event: DragEndEvent) {
        const project = event.active.data.current?.project as ProjectSummary | undefined
        const groupId = (event.over?.data.current?.groupId ?? null) as ProjectGroupId

        setActiveProjectId(null)

        if (!project || project.groupId === groupId) return
        actions.moveProject(project, groupId)
    }

    return (
        <Base.SidebarGroup>
            <Base.SidebarGroupLabel className="flex items-center justify-between pr-1">
                <span>프로젝트</span>
                <button
                    type="button"
                    className="rounded p-0.5 hover:bg-sidebar-accent"
                    onClick={actions.createGroup}
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </Base.SidebarGroupLabel>

            <Base.SidebarGroupContent>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={() => setActiveProjectId(null)}
                >
                    <Base.SidebarMenu>
                        {isLoading ? (
                            <SidebarMessage>불러오는 중...</SidebarMessage>
                        ) : groupItems.length === 0 && ungroupedProjects.length === 0 ? (
                            <SidebarMessage>프로젝트가 없습니다</SidebarMessage>
                        ) : (
                            <>
                                {groupItems.map((group) => (
                                    <ProjectGroup
                                        key={group.id}
                                        group={group}
                                        currentProjectId={currentProjectId}
                                        rename={rename}
                                        actions={actions}
                                        onRenameValueChange={onRenameValueChange}
                                        onCommitRename={onCommitRename}
                                        onCancelRename={onCancelRename}
                                    />
                                ))}
                                <RootProjects
                                    projects={ungroupedProjects}
                                    currentProjectId={currentProjectId}
                                    rename={rename}
                                    actions={actions}
                                    onRenameValueChange={onRenameValueChange}
                                    onCommitRename={onCommitRename}
                                    onCancelRename={onCancelRename}
                                />
                            </>
                        )}
                    </Base.SidebarMenu>
                    <DragOverlay>
                        {activeProject && <ProjectDragPreview project={activeProject} />}
                    </DragOverlay>
                </DndContext>
            </Base.SidebarGroupContent>
        </Base.SidebarGroup>
    )
}

interface ProjectGroupProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    group: GroupWithProjects
}

function ProjectGroup({
    group,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: ProjectGroupProps) {
    const droppableId = `project-group:${group.id}`
    const { isOver, setNodeRef } = useDroppable({
        id: droppableId,
        data: { groupId: group.id },
    })
    const groupRenameTarget = { type: 'group', id: group.id } as const
    const isRenaming = isSameRenameTarget(rename.target, groupRenameTarget)

    return (
        <Base.SidebarMenuItem ref={setNodeRef}>
            <Collapsible defaultOpen className="group/collapsible">
                <div
                    className={cn(
                        'flex items-center gap-0.5 pr-1 transition-colors',
                        isOver && 'bg-sidebar-accent',
                    )}
                >
                    <CollapsibleTrigger
                        render={
                            <button
                                type="button"
                                className="flex flex-1 items-center gap-1 rounded px-2 py-1 text-sm hover:bg-sidebar-accent"
                            />
                        }
                    >
                        <ChevronRight className="chevron h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        {isRenaming ? (
                            <RenameInput
                                className="h-5 flex-1 px-1 py-0 text-xs"
                                value={rename.value}
                                onChange={onRenameValueChange}
                                onCommit={() => onCommitRename(groupRenameTarget)}
                                onCancel={onCancelRename}
                                stopClickPropagation
                            />
                        ) : (
                            <span className="truncate text-xs">{group.name}</span>
                        )}
                    </CollapsibleTrigger>

                    <GroupMenu
                        onCreateProject={() => actions.createProject(group)}
                        onRename={() => actions.renameGroup(group)}
                        onDelete={() => actions.deleteGroup(group)}
                    />
                </div>

                <CollapsibleContent>
                    <Base.SidebarMenuSub>
                        {group.projects.length === 0 ? (
                            <div
                                className={cn(
                                    'py-1 pl-8 text-xs text-muted-foreground transition-colors',
                                    isOver && 'text-sidebar-accent-foreground',
                                )}
                            >
                                프로젝트 없음
                            </div>
                        ) : (
                            group.projects.map((project) => (
                                <ProjectRow
                                    key={project.id}
                                    project={project}
                                    variant="sub"
                                    dropGroupId={group.id}
                                    isActive={currentProjectId === project.id}
                                    isRenaming={isSameRenameTarget(rename.target, {
                                        type: 'project',
                                        id: project.id,
                                    })}
                                    renameValue={rename.value}
                                    onRenameValueChange={onRenameValueChange}
                                    onCommitRename={() =>
                                        onCommitRename({ type: 'project', id: project.id })
                                    }
                                    onCancelRename={onCancelRename}
                                    onSelect={() => actions.selectProject(project)}
                                    onRename={() => actions.renameProject(project)}
                                    onDuplicate={() => actions.duplicateProject(project)}
                                    onDelete={() => actions.deleteProject(project)}
                                />
                            ))
                        )}
                    </Base.SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </Base.SidebarMenuItem>
    )
}

interface RootProjectsProps extends Omit<ProjectTreeProps, 'groups' | 'isLoading'> {
    projects: ProjectSummary[]
}

function RootProjects({
    projects,
    currentProjectId,
    rename,
    actions,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
}: RootProjectsProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: 'project-root',
        data: { groupId: null satisfies ProjectGroupId },
    })

    if (projects.length === 0) {
        return (
            <Base.SidebarMenuItem ref={setNodeRef}>
                <div
                    className={cn('mt-1 min-h-4 transition-colors', isOver && 'bg-sidebar-accent')}
                />
            </Base.SidebarMenuItem>
        )
    }

    return (
        <Base.SidebarMenuItem ref={setNodeRef}>
            <div className={cn('mt-1 flex flex-col gap-0.5', isOver && 'bg-sidebar-accent')}>
                {projects.map((project) => (
                    <ProjectRow
                        key={project.id}
                        project={project}
                        variant="root"
                        dropGroupId={null}
                        isActive={currentProjectId === project.id}
                        isRenaming={isSameRenameTarget(rename.target, {
                            type: 'project',
                            id: project.id,
                        })}
                        renameValue={rename.value}
                        onRenameValueChange={onRenameValueChange}
                        onCommitRename={() => onCommitRename({ type: 'project', id: project.id })}
                        onCancelRename={onCancelRename}
                        onSelect={() => actions.selectProject(project)}
                        onRename={() => actions.renameProject(project)}
                        onDuplicate={() => actions.duplicateProject(project)}
                        onDelete={() => actions.deleteProject(project)}
                    />
                ))}
            </div>
        </Base.SidebarMenuItem>
    )
}

interface ProjectRowProps {
    project: ProjectSummary
    variant: 'root' | 'sub'
    dropGroupId: ProjectGroupId
    isActive: boolean
    isRenaming: boolean
    renameValue: string
    onRenameValueChange: (value: string) => void
    onCommitRename: () => void
    onCancelRename: () => void
    onSelect: () => void
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}

function ProjectRow({
    project,
    variant,
    dropGroupId,
    isActive,
    isRenaming,
    renameValue,
    onRenameValueChange,
    onCommitRename,
    onCancelRename,
    onSelect,
    onRename,
    onDuplicate,
    onDelete,
}: ProjectRowProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `project:${project.id}`,
        data: { project },
        disabled: isRenaming,
    })
    const { setNodeRef: setDropNodeRef } = useDroppable({
        id: `project-row:${project.id}`,
        data: { groupId: dropGroupId },
        disabled: isRenaming,
    })
    const setRowRef = useCallback(
        (node: HTMLElement | null) => {
            setNodeRef(node)
            setDropNodeRef(node)
        },
        [setNodeRef, setDropNodeRef],
    )
    const style = {
        transform: CSS.Translate.toString(transform),
    }

    const row = (
        <div
            className={cn(
                'group/project flex items-center gap-0.5 pr-1',
                isDragging && 'opacity-40',
            )}
        >
            {isRenaming ? (
                <RenameInput
                    className="h-6 flex-1 px-1 py-0 text-xs"
                    value={renameValue}
                    onChange={onRenameValueChange}
                    onCommit={onCommitRename}
                    onCancel={onCancelRename}
                />
            ) : variant === 'root' ? (
                <Base.SidebarMenuButton
                    isActive={isActive}
                    className="h-7 flex-1 cursor-grab px-2 active:cursor-grabbing"
                    onClick={onSelect}
                    {...attributes}
                    {...listeners}
                >
                    <File className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.name}</span>
                </Base.SidebarMenuButton>
            ) : (
                <Base.SidebarMenuSubButton
                    isActive={isActive}
                    className="flex-1 cursor-grab active:cursor-grabbing"
                    onClick={onSelect}
                    {...attributes}
                    {...listeners}
                >
                    <File className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.name}</span>
                </Base.SidebarMenuSubButton>
            )}

            <ProjectMenu onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
        </div>
    )

    if (variant === 'root') {
        return (
            <div ref={setRowRef} style={style}>
                {row}
            </div>
        )
    }

    return (
        <Base.SidebarMenuSubItem ref={setRowRef} style={style}>
            {row}
        </Base.SidebarMenuSubItem>
    )
}

function ProjectDragPreview({ project }: { project: ProjectSummary }) {
    return (
        <div className="flex h-7 min-w-36 items-center gap-2 border bg-popover px-2 text-xs text-popover-foreground shadow">
            <File className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{project.name}</span>
        </div>
    )
}

interface RenameInputProps {
    className?: string
    value: string
    stopClickPropagation?: boolean
    onChange: (value: string) => void
    onCommit: () => void
    onCancel: () => void
}

function RenameInput({
    className,
    value,
    stopClickPropagation = false,
    onChange,
    onCommit,
    onCancel,
}: RenameInputProps) {
    const skipBlurCommit = useRef(false)

    return (
        <Input
            className={className}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
                if (skipBlurCommit.current) {
                    skipBlurCommit.current = false
                    return
                }
                onCommit()
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCommit()
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    skipBlurCommit.current = true
                    onCancel()
                }
            }}
            autoFocus
            onClick={stopClickPropagation ? (event) => event.stopPropagation() : undefined}
        />
    )
}

function GroupMenu({
    onCreateProject,
    onRename,
    onDelete,
}: {
    onCreateProject: () => void
    onRename: () => void
    onDelete: () => void
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/collapsible:opacity-100"
                    />
                }
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onCreateProject}>새 프로젝트</DropdownMenuItem>
                <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                >
                    삭제
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function ProjectMenu({
    onRename,
    onDuplicate,
    onDelete,
}: {
    onRename: () => void
    onDuplicate: () => void
    onDelete: () => void
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover/project:opacity-100"
                    />
                }
            >
                <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>복제</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                >
                    삭제
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function SidebarMessage({ children }: { children: string }) {
    return <div className="px-2 py-4 text-center text-xs text-muted-foreground">{children}</div>
}

function isSameRenameTarget(current: RenameTarget, target: ActiveRenameTarget) {
    return current?.type === target.type && current.id === target.id
}

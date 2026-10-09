import type { EnqueuePosition } from '@nai-factory/shared'
import {
    Copy,
    Images,
    ListEnd,
    ListStart,
    ListX,
    type LucideIcon,
    Pencil,
    SquareCheck,
    Trash2,
} from 'lucide-react'
import { Fragment } from 'react'

import {
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface SceneMenuItem {
    label: string
    icon: LucideIcon
    onClick: () => void
    disabled?: boolean
    destructive?: boolean
}

export interface SceneMenu {
    title: string
    groups: SceneMenuItem[][]
}

export interface SceneSelectionActions {
    count: number
    queueCount: number
    onEnqueue: (position: EnqueuePosition) => void
    onClearQueue: () => void
    onDelete: () => void
}

export function selectionMenu(actions: SceneSelectionActions): SceneMenu {
    return {
        title: `${actions.count}개 씬 선택됨`,
        groups: [
            [
                {
                    label: '큐 앞에 추가',
                    icon: ListStart,
                    onClick: () => actions.onEnqueue('front'),
                },
                { label: '큐 뒤에 추가', icon: ListEnd, onClick: () => actions.onEnqueue('back') },
                {
                    label: actions.queueCount > 0 ? `큐 삭제 (${actions.queueCount})` : '큐 삭제',
                    icon: ListX,
                    onClick: actions.onClearQueue,
                    disabled: actions.queueCount === 0,
                },
            ],
            [{ label: '삭제', icon: Trash2, onClick: actions.onDelete, destructive: true }],
        ],
    }
}

export function singleSceneMenu(scene: {
    name: string
    queueCount: number
    pending: { clearQueue: boolean; duplicate: boolean }
    onOpenImages: () => void
    onEdit: () => void
    onEnqueue: (position: EnqueuePosition) => void
    onClearQueue: () => void
    onSelect?: () => void
    onDuplicate: () => void
    onDelete: () => void
}): SceneMenu {
    return {
        title: scene.name,
        groups: [
            [
                { label: '이미지 보기', icon: Images, onClick: scene.onOpenImages },
                { label: '수정', icon: Pencil, onClick: scene.onEdit },
            ],
            [
                {
                    label: '큐 앞에 추가',
                    icon: ListStart,
                    onClick: () => scene.onEnqueue('front'),
                },
                {
                    label: '큐 뒤에 추가',
                    icon: ListEnd,
                    onClick: () => scene.onEnqueue('back'),
                },
                {
                    label: scene.queueCount > 0 ? `큐 삭제 (${scene.queueCount})` : '큐 삭제',
                    icon: ListX,
                    onClick: scene.onClearQueue,
                    disabled: scene.pending.clearQueue || scene.queueCount === 0,
                },
            ],
            [
                ...(scene.onSelect
                    ? [{ label: '선택', icon: SquareCheck, onClick: scene.onSelect }]
                    : []),
                {
                    label: '복제',
                    icon: Copy,
                    onClick: scene.onDuplicate,
                    disabled: scene.pending.duplicate,
                },
            ],
            [{ label: '삭제', icon: Trash2, onClick: scene.onDelete, destructive: true }],
        ],
    }
}

export function SceneContextMenuItems({ menu }: { menu: SceneMenu }) {
    return menu.groups.map((group, index) => (
        <Fragment key={index}>
            {index > 0 && <ContextMenuSeparator />}
            <ContextMenuGroup>
                {index === 0 && (
                    <ContextMenuLabel className="max-w-56 truncate">{menu.title}</ContextMenuLabel>
                )}
                {group.map(({ label, icon: Icon, onClick, disabled, destructive }) => (
                    <ContextMenuItem
                        key={label}
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={onClick}
                        disabled={disabled}
                    >
                        <Icon />
                        {label}
                    </ContextMenuItem>
                ))}
            </ContextMenuGroup>
        </Fragment>
    ))
}

export function SceneDropdownMenuItems({ menu }: { menu: SceneMenu }) {
    return menu.groups.map((group, index) => (
        <Fragment key={index}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
                {index === 0 && (
                    <DropdownMenuLabel className="max-w-56 truncate">
                        {menu.title}
                    </DropdownMenuLabel>
                )}
                {group.map(({ label, icon: Icon, onClick, disabled, destructive }) => (
                    <DropdownMenuItem
                        key={label}
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={onClick}
                        disabled={disabled}
                    >
                        <Icon />
                        {label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
        </Fragment>
    ))
}

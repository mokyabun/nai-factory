import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Image } from '@nai-factory/shared'
import { Check, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface SortableImageItemProps {
    img: Image
    index: number
    imageUrl: string
    selected: boolean
    onView: (img: Image) => void
    onDelete: (img: Image) => void
    onToggleSelect: (id: number) => void
    onSelectDragStart: (index: number, selected: boolean) => void
    onSelectDragEnter: (index: number) => void
}

export function SortableImageItem({
    img,
    index,
    imageUrl,
    selected,
    onView,
    onDelete,
    onToggleSelect,
    onSelectDragStart,
    onSelectDragEnter,
}: SortableImageItemProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
        id: img.id,
        animateLayoutChanges: () => false,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: 'none',
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative h-full cursor-grab ${selected ? 'ring-2 ring-primary ring-offset-2' : ''} ${isDragging ? 'opacity-40' : ''}`}
            onPointerEnter={() => onSelectDragEnter(index)}
        >
            <button
                type="button"
                aria-label="이미지 보기"
                className="h-full w-full overflow-hidden rounded-lg border bg-muted"
                onClick={() => onView(img)}
            >
                <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                />
            </button>

            <button
                type="button"
                aria-label={selected ? '이미지 선택 해제' : '이미지 선택'}
                className={`pointer-events-none absolute top-1.5 left-1.5 z-20 flex h-6 w-6 items-center justify-center rounded border-2 opacity-0 after:absolute after:-inset-2 shadow-sm transition-all group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 ${
                    selected
                        ? 'border-primary bg-primary text-primary-foreground opacity-100'
                        : 'border-white/75 bg-black/35 text-transparent hover:border-primary hover:bg-primary hover:text-primary-foreground'
                }`}
                onClick={(e) => {
                    e.stopPropagation()
                    if (e.detail > 0) return
                    onToggleSelect(img.id)
                }}
                onPointerDown={(e) => {
                    if (e.button !== 0) return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelectDragStart(index, selected)
                }}
            >
                <Check className="h-3 w-3" />
            </button>

            <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-1.5 right-1.5 hidden rounded-full bg-black/50 text-white hover:bg-black/70 group-hover:flex [@media(hover:none)]:flex"
                onPointerDown={(e) => {
                    e.stopPropagation()
                }}
                onClick={(e) => {
                    e.stopPropagation()
                    onDelete(img)
                }}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}

import type { Image } from '@nai-factory/shared'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SortableImageItemProps {
    img: Image
    imageUrl: string
    onView: (img: Image) => void
    onDelete: (img: Image) => void
}

export function SortableImageItem({ img, imageUrl, onView, onDelete }: SortableImageItemProps) {
    return (
        <div className="group relative aspect-[3/4] cursor-pointer">
            <button
                type="button"
                className="h-full w-full overflow-hidden rounded-lg border bg-muted"
                onClick={() => onView(img)}
            >
                <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    draggable={false}
                />
            </button>

            <Button
                variant="ghost"
                size="icon"
                className="absolute top-1.5 right-1.5 hidden h-7 w-7 rounded-full bg-black/50 text-white hover:bg-black/70 group-hover:flex"
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

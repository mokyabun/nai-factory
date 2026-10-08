import { ImageOff, Loader, RotateCw } from 'lucide-react'
import { useState } from 'react'

import { imageResourceUrl, type ImageUrlResource } from '@/lib/api/utils'
import { cn } from '@/lib/utils'

interface ImageSurfaceProps {
    image: ImageUrlResource
    alt?: string
    className?: string
    /** Tone for the loading/failure overlays; `dark` for full-screen viewers. */
    tone?: 'light' | 'dark'
}

type LoadState = { url: string; status: 'loaded' | 'failed' }

/**
 * Shows an image's thumbnail right away and swaps in the original once it has loaded, so switching
 * images never flashes an empty frame. A failed original keeps the thumbnail and offers a retry.
 * Both layers fill the surface with `object-contain`, so they line up regardless of resolution.
 */
export function ImageSurface({ image, alt = '', className, tone = 'light' }: ImageSurfaceProps) {
    const thumbnailUrl = imageResourceUrl(image, 'thumbnail')
    const sourceUrl = imageResourceUrl(image, 'source')
    const [attempt, setAttempt] = useState(0)
    const [load, setLoad] = useState<LoadState | null>(null)

    const requestUrl =
        attempt === 0
            ? sourceUrl
            : `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}retry=${attempt}`
    const status = load?.url === requestUrl ? load.status : 'loading'
    const layer = 'col-start-1 row-start-1 h-full w-full object-contain'

    return (
        <div className={cn('relative grid h-full w-full min-h-0 min-w-0', className)}>
            {status !== 'loaded' && thumbnailUrl !== sourceUrl && (
                <img src={thumbnailUrl} alt="" className={layer} draggable={false} />
            )}
            <img
                key={requestUrl}
                src={requestUrl}
                alt={alt}
                className={cn(layer, status !== 'loaded' && 'opacity-0')}
                draggable={false}
                onLoad={() => setLoad({ url: requestUrl, status: 'loaded' })}
                onError={() => setLoad({ url: requestUrl, status: 'failed' })}
            />

            {status === 'loading' && (
                <div
                    className={cn(
                        'pointer-events-none absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full',
                        tone === 'dark' ? 'bg-black/50 text-white/80' : 'bg-background/80',
                    )}
                    aria-hidden
                >
                    <Loader className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                </div>
            )}

            {status === 'failed' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div
                        className={cn(
                            'flex flex-col items-center gap-2 px-4 py-3 text-xs shadow-sm',
                            tone === 'dark'
                                ? 'bg-black/70 text-white/80'
                                : 'bg-background/90 text-muted-foreground',
                        )}
                        role="alert"
                    >
                        <ImageOff className="h-5 w-5" />
                        원본 이미지를 불러오지 못했습니다
                        <button
                            type="button"
                            className="flex items-center gap-1 underline-offset-2 hover:underline"
                            onClick={() => setAttempt((value) => value + 1)}
                        >
                            <RotateCw className="h-3 w-3" />
                            다시 시도
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

import { createFileRoute } from '@tanstack/react-router'

import { ImageViewerPage } from '@/features/images/image-viewer-page'

export const Route = createFileRoute('/scene/$sceneId/images/$imageId')({
    component: ImageViewerRoute,
})

function ImageViewerRoute() {
    const { sceneId, imageId } = Route.useParams()
    return <ImageViewerPage sceneId={Number(sceneId)} imageId={Number(imageId)} />
}

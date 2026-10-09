import { createFileRoute } from '@tanstack/react-router'

import { ImagesPage } from '@/features/images/scene-images-page'

export const Route = createFileRoute('/scene/$sceneId/images/')({ component: SceneImagesRoute })

function SceneImagesRoute() {
    const { sceneId } = Route.useParams()
    return <ImagesPage sceneId={Number(sceneId)} />
}

import { createFileRoute } from '@tanstack/react-router'

import { SceneEditPage } from '@/features/scene/scene-editor-page'

export const Route = createFileRoute('/scene/$sceneId/')({ component: SceneEditorRoute })

function SceneEditorRoute() {
    const { sceneId } = Route.useParams()
    return <SceneEditPage sceneId={Number(sceneId)} />
}

import { createFileRoute } from '@tanstack/react-router'

import { SceneEditorPage } from '@/features/scene/scene-editor-page'

export const Route = createFileRoute('/scene/$sceneId/')({ component: SceneEditorRoute })

function SceneEditorRoute() {
    const { sceneId } = Route.useParams()
    return <SceneEditorPage sceneId={Number(sceneId)} />
}

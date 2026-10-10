import { createFileRoute } from '@tanstack/react-router'

import { PlaygroundPage } from '@/features/playground/playground-page'

export const Route = createFileRoute('/playground')({ component: PlaygroundPage })

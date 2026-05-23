import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/scene/$sceneId')({ component: () => <Outlet /> })

import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/project/$projectId')({ component: () => <Outlet /> })

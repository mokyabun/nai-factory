import { createFileRoute } from '@tanstack/react-router'

import { SettingsPanel } from '@/features/settings/settings-page'

export const Route = createFileRoute('/settings')({
    component: SettingsPage,
})

function SettingsPage() {
    return <SettingsPanel />
}

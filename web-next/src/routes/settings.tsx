import { createFileRoute } from '@tanstack/react-router'
import { SettingsPanel } from '@/components/app/settings/settings-panel'

export const Route = createFileRoute('/settings')({
    component: SettingsPage,
})

function SettingsPage() {
    return <SettingsPanel />
}

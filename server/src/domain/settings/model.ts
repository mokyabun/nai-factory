import { t } from 'elysia'
import { GlobalSettings } from '@/types'

export const SettingsModel = {
    updateBody: t.Partial(GlobalSettings),
}

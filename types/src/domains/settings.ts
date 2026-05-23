import { GlobalSettings } from '../settings'

export const UpdateSettingsBody = GlobalSettings.partial()
export type UpdateSettingsBody = typeof UpdateSettingsBody._output

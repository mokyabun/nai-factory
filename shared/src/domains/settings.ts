import type * as z from 'zod'
import { GlobalSettings } from '../settings'

export const SettingsPatchBody = GlobalSettings.partial()

export type SettingsPatchBody = z.infer<typeof SettingsPatchBody>

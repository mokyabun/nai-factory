import { treaty } from '@elysiajs/eden'
import type { App } from 'server'

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const api = treaty<App>(BASE_URL)

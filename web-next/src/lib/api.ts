import { treaty } from '@elysia/eden'

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// biome-ignore lint/suspicious/noExplicitAny: Eden cannot consume the workspace server type without duplicate Elysia instance conflicts.
export const api = treaty<any>(BASE_URL) as any

export function imageUrl(path: string): string {
    return `${BASE_URL}/${path}`
}

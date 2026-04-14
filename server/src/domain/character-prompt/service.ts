import { eq } from 'drizzle-orm'
import { status } from 'elysia'
import type { CharacterPrompt } from '@/types'
import { db } from '@/db'
import { projects } from '@/db/schema'

async function getProject(projectId: number) {
    const [proj] = await db.select().from(projects).where(eq(projects.id, projectId))
    if (!proj) throw status(404, 'Project not found')
    
    return proj
}

export async function list(projectId: number) {
    const proj = await getProject(projectId)
    return proj.characterPrompts ?? []
}

export async function create(projectId: number, body: Partial<CharacterPrompt>) {
    const proj = await getProject(projectId)

    const newChar: CharacterPrompt = {
        enabled: body.enabled ?? true,
        center: body.center ?? { x: 0.5, y: 0.5 },
        prompt: body.prompt ?? '',
        uc: body.uc ?? '',
    }

    const updated = [...(proj.characterPrompts ?? []), newChar]

    const [result] = await db
        .update(projects)
        .set({ characterPrompts: updated, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

export async function update(projectId: number, index: number, body: Partial<CharacterPrompt>) {
    const proj = await getProject(projectId)
    const chars = [...(proj.characterPrompts ?? [])]

    if (index < 0 || index >= chars.length) throw status(404, 'Character prompt not found')

    chars[index] = { ...chars[index]!, ...body }

    const [result] = await db
        .update(projects)
        .set({ characterPrompts: chars, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

export async function remove(projectId: number, index: number) {
    const proj = await getProject(projectId)
    const chars = [...(proj.characterPrompts ?? [])]

    if (index < 0 || index >= chars.length) throw status(404, 'Character prompt not found')

    chars.splice(index, 1)

    const [result] = await db
        .update(projects)
        .set({ characterPrompts: chars, updatedAt: new Date().toISOString() })
        .where(eq(projects.id, projectId))
        .returning()

    return result!.characterPrompts
}

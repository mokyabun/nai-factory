import { asc, eq } from 'drizzle-orm'

import { type DbOrTx, images, scenes } from '@/db'

export type ImageRow = typeof images.$inferSelect

export function listByScene(db: DbOrTx, sceneId: number) {
    return db
        .select()
        .from(images)
        .where(eq(images.sceneId, sceneId))
        .orderBy(asc(images.position), asc(images.id))
        .all()
}

export function getWithProject(db: DbOrTx, id: number) {
    return (
        db
            .select({ image: images, projectId: scenes.projectId })
            .from(images)
            .innerJoin(scenes, eq(images.sceneId, scenes.id))
            .where(eq(images.id, id))
            .get() ?? null
    )
}

export function getById(db: DbOrTx, id: number) {
    return db.select().from(images).where(eq(images.id, id)).get() ?? null
}

export function firstPosition(db: DbOrTx, sceneId: number) {
    return (
        db
            .select({ position: images.position })
            .from(images)
            .where(eq(images.sceneId, sceneId))
            .orderBy(asc(images.position), asc(images.id))
            .limit(1)
            .get()?.position ?? null
    )
}

export function insert(db: DbOrTx, values: typeof images.$inferInsert) {
    return db.insert(images).values(values).returning().get()
}

export function setPosition(db: DbOrTx, id: number, position: string) {
    db.update(images).set({ position }).where(eq(images.id, id)).run()
}

export function remove(db: DbOrTx, id: number) {
    db.delete(images).where(eq(images.id, id)).run()
}

import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing-jittered'
import { HTTPException } from 'hono/http-exception'
import logger from '@/logger'

export const DISPLAY_ORDER_REBALANCE_LENGTH = 32

export type DisplayOrderItem = {
    id: number
    displayOrder: string
}

export type DisplayOrderUpdate = DisplayOrderItem

export type DisplayOrderPlan =
    | {
          type: 'single'
          displayOrder: string
      }
    | {
          type: 'rebalance'
          displayOrder: string
          updates: DisplayOrderUpdate[]
      }

type PlanDisplayOrderUpdateOptions = {
    entity: string
    items: DisplayOrderItem[]
    id: number
    prevId: number | null
    nextId: number | null
    maxLength?: number
    logContext?: Record<string, unknown>
}

export function nextDisplayOrder(after?: string | null) {
    return generateKeyBetween(after ?? null, null)
}

export function displayOrderBetween(prev?: string | null, next?: string | null) {
    return generateKeyBetween(prev ?? null, next ?? null)
}

function byDisplayOrderThenId(a: DisplayOrderItem, b: DisplayOrderItem) {
    if (a.displayOrder < b.displayOrder) return -1
    if (a.displayOrder > b.displayOrder) return 1
    return a.id - b.id
}

export function planDisplayOrderUpdate({
    entity,
    items,
    id,
    prevId,
    nextId,
    maxLength = DISPLAY_ORDER_REBALANCE_LENGTH,
    logContext,
}: PlanDisplayOrderUpdateOptions): DisplayOrderPlan | null {
    if (!items.some((item) => item.id === id)) return null
    if (prevId === id || nextId === id || (prevId !== null && prevId === nextId)) {
        throw new HTTPException(400, { message: `Invalid ${entity} order neighbors` })
    }

    const prevOrder =
        prevId !== null ? items.find((item) => item.id === prevId)?.displayOrder : null
    const nextOrder =
        nextId !== null ? items.find((item) => item.id === nextId)?.displayOrder : null

    if (prevId !== null && prevOrder === undefined) {
        throw new HTTPException(404, { message: `Previous ${entity} not found` })
    }
    if (nextId !== null && nextOrder === undefined) {
        throw new HTTPException(404, { message: `Next ${entity} not found` })
    }

    const displayOrder = displayOrderBetween(prevOrder, nextOrder)
    if (displayOrder.length < maxLength) {
        return { type: 'single', displayOrder }
    }

    const keys = generateNKeysBetween(null, null, items.length)
    const orderedItems = items
        .map((item) => (item.id === id ? { ...item, displayOrder } : item))
        .sort(byDisplayOrderThenId)
    const updates = orderedItems.map((item, index) => ({
        id: item.id,
        displayOrder: keys[index] ?? displayOrder,
    }))
    const movedUpdate = updates.find((item) => item.id === id)

    logger.info(
        {
            entity,
            id,
            prevId,
            nextId,
            itemCount: items.length,
            maxLength,
            generatedLength: displayOrder.length,
            ...logContext,
        },
        'Rebalancing display orders',
    )

    return {
        type: 'rebalance',
        displayOrder: movedUpdate?.displayOrder ?? displayOrder,
        updates,
    }
}

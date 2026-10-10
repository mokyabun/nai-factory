import { groups } from './groups'
import { jobs } from './jobs'
import { debug, playground, sdStudio, settings, stash, system, tags } from './misc'
import { projects } from './projects'
import { characterReferences, vibeTransfers } from './references'
import { images, scenes } from './scenes'

export * from './define'

export const contract = {
    system,
    groups,
    projects,
    scenes,
    images,
    vibeTransfers,
    characterReferences,
    jobs,
    playground,
    settings,
    stash,
    sdStudio,
    tags,
    debug,
}

export type Contract = typeof contract

/** Paths outside the JSON contract. */
export const API_PREFIX = '/api'
export const assetPath = (assetId: number) => `${API_PREFIX}/assets/${assetId}`
export const EVENTS_PATH = `${API_PREFIX}/events`

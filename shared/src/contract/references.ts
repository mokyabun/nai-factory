import { IdParams, MoveBody } from '../inputs/common'
import { CharacterReferencePatch, VibeTransferPatch } from '../inputs/references'
import { CharacterReference, VibeTransfer } from '../schemas/references'
import { endpoint } from './define'

export const vibeTransfers = {
    update: endpoint({
        method: 'PATCH',
        path: '/vibe-transfers/:id',
        params: IdParams,
        body: VibeTransferPatch,
        response: VibeTransfer,
    }),
    move: endpoint({
        method: 'PATCH',
        path: '/vibe-transfers/:id/position',
        params: IdParams,
        body: MoveBody,
        response: VibeTransfer,
    }),
    delete: endpoint({
        method: 'DELETE',
        path: '/vibe-transfers/:id',
        params: IdParams,
        response: null,
    }),
}

export const characterReferences = {
    update: endpoint({
        method: 'PATCH',
        path: '/character-references/:id',
        params: IdParams,
        body: CharacterReferencePatch,
        response: CharacterReference,
    }),
    move: endpoint({
        method: 'PATCH',
        path: '/character-references/:id/position',
        params: IdParams,
        body: MoveBody,
        response: CharacterReference,
    }),
    delete: endpoint({
        method: 'DELETE',
        path: '/character-references/:id',
        params: IdParams,
        response: null,
    }),
}

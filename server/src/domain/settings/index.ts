import { Elysia, status } from 'elysia'
import { SettingsModel } from './model'
import * as service from './service'

export const setting = new Elysia({ prefix: '/settings' })
    .get('/', () => service.get())
    .patch('/', ({ body }) => service.update(body), { body: SettingsModel.updateBody })
    .delete('/', () => {
        service.reset()
        return status(204)
    })

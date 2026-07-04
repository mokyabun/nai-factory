import type { CharacterReferenceUploadBody, VibeTransferUploadBody } from '@nai-factory/shared'
import { request } from './client'

type ImageUploadBody = VibeTransferUploadBody | CharacterReferenceUploadBody

async function formDataFromUpload(body: ImageUploadBody) {
    const formData = new FormData()

    if (body.image instanceof Blob) {
        formData.set('image', body.image, body.image.name)
        return formData
    }

    const blob = new Blob([await body.image.arrayBuffer()], { type: body.image.type })
    formData.set('image', blob, body.image.name)
    return formData
}

export async function postUpload<T>(path: string, body: ImageUploadBody) {
    return request<T>(path, {
        method: 'post',
        body: await formDataFromUpload(body),
    })
}

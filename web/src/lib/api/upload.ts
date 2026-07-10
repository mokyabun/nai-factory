import type {
    CharacterReferenceUploadBody,
    ProjectArchiveImportBody,
    VibeTransferUploadBody,
} from '@nai-factory/shared'
import { request } from './client'

type UploadBody = VibeTransferUploadBody | CharacterReferenceUploadBody | ProjectArchiveImportBody
type UploadFile = UploadBody extends Record<string, infer File> ? File : never

function uploadEntry(body: UploadBody): [string, UploadFile] {
    if ('image' in body) return ['image', body.image]
    return ['archive', body.archive]
}

async function formDataFromUpload(body: UploadBody) {
    const formData = new FormData()
    const [name, file] = uploadEntry(body)

    if (file instanceof Blob) {
        formData.set(name, file, file.name)
        return formData
    }

    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    formData.set(name, blob, file.name)
    return formData
}

export async function postUpload<T>(path: string, body: UploadBody) {
    return request<T>(path, {
        method: 'post',
        body: await formDataFromUpload(body),
    })
}

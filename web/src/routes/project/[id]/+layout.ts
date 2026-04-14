import { api } from '$lib/api'

export const load = async ({ params }: { params: { id: string } }) => {
    const projectId = Number(params.id)
    const { data: project } = await api.api.projects({ projectId }).get()
    return { project }
}

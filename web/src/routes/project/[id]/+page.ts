export const load = ({ params }: { params: { id: string } }) => ({
    projectId: Number(params.id),
})

let _projectId = $state<number | null>(null)

export const selectedProject = {
    get id() {
        return _projectId
    },
    set id(v: number | null) {
        _projectId = v
    },
}

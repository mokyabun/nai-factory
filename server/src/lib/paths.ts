import { mkdirSync, realpathSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export class UnsafePathError extends Error {
    constructor(path: string) {
        super(`Unsafe path: ${JSON.stringify(path)}`)
        this.name = 'UnsafePathError'
    }
}

/**
 * Validates a `/`-separated relative path: no absolute paths, drive letters, backslashes,
 * NUL bytes, empty segments, `.` or `..`.
 */
export function assertSafeRelPath(relPath: string) {
    if (
        relPath.length === 0 ||
        relPath.includes('\0') ||
        relPath.includes('\\') ||
        relPath.startsWith('/') ||
        /^[A-Za-z]:/.test(relPath) ||
        isAbsolute(relPath)
    ) {
        throw new UnsafePathError(relPath)
    }

    for (const segment of relPath.split('/')) {
        if (segment === '' || segment === '.' || segment === '..') {
            throw new UnsafePathError(relPath)
        }
    }

    return relPath
}

function isInside(root: string, target: string) {
    return target === root || target.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)
}

/** Joins a single validated name below `base`, e.g. an export folder below the export root. */
export function resolveInside(base: string, relPath: string) {
    assertSafeRelPath(relPath)
    const root = resolve(base)
    const target = resolve(root, ...relPath.split('/'))
    if (!isInside(root, target) || target === root) throw new UnsafePathError(relPath)
    return target
}

export type DataPaths = ReturnType<typeof createDataPaths>

/** Resolves stored relative paths against the data root and refuses anything outside it. */
export function createDataPaths(dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    const root = realpathSync(resolve(dataDir))

    return {
        root,

        /** Absolute path for a stored relative path (lexical check only). */
        resolve(relPath: string) {
            return resolveInside(root, relPath)
        },

        /** Like {@link resolve}, but also follows symlinks of an existing file. */
        async resolveExisting(relPath: string) {
            const target = resolveInside(root, relPath)
            const real = await realpath(target)
            if (!isInside(root, real)) throw new UnsafePathError(relPath)
            return real
        },

        /** Converts an absolute path below the root into a `/`-separated relative path. */
        toRelPath(absolutePath: string) {
            const target = resolve(absolutePath)
            if (!isInside(root, target) || target === root) {
                throw new UnsafePathError(absolutePath)
            }
            return assertSafeRelPath(relative(root, target).split(sep).join('/'))
        },

        join(...segments: string[]) {
            return join(root, ...segments)
        },
    }
}

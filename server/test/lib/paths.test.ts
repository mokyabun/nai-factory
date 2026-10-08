import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assertSafeRelPath, createDataPaths, resolveInside, UnsafePathError } from '@/lib/paths'

const root = await mkdtemp(join(tmpdir(), 'paths-test-'))
const outside = await mkdtemp(join(tmpdir(), 'paths-outside-'))
afterAll(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
})

describe('assertSafeRelPath', () => {
    it.each([
        '../package.json',
        'images/../../etc/passwd',
        '/etc/passwd',
        'C:/Windows',
        'images\\..\\x',
        'a//b',
        './a',
        'a/.',
        '',
        'a\0b',
    ])('rejects %p', (path) => {
        expect(() => assertSafeRelPath(path)).toThrow(UnsafePathError)
    })

    it('accepts nested relative paths', () => {
        expect(assertSafeRelPath('images/1/2/file.png')).toBe('images/1/2/file.png')
    })
})

describe('data paths', () => {
    const paths = createDataPaths(root)

    it('resolves below the root and converts back', () => {
        const absolute = paths.resolve('images/a.png')
        expect(absolute.startsWith(paths.root)).toBe(true)
        expect(paths.toRelPath(absolute)).toBe('images/a.png')
    })

    it('refuses absolute paths outside the root', () => {
        expect(() => paths.toRelPath(join(outside, 'x'))).toThrow(UnsafePathError)
    })

    it('refuses symlinks that escape the root', async () => {
        await writeFile(join(outside, 'secret.txt'), 'secret')
        await symlink(join(outside, 'secret.txt'), join(paths.root, 'link.txt'))
        const error = await paths.resolveExisting('link.txt').then(
            () => null,
            (reason: unknown) => reason,
        )
        expect(error).toBeInstanceOf(UnsafePathError)
    })

    it('resolveInside keeps names below the base', () => {
        expect(resolveInside(paths.root, 'export 1')).toBe(join(paths.root, 'export 1'))
        expect(() => resolveInside(root, '../x')).toThrow(UnsafePathError)
    })
})

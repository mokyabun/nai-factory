import adapter from '@sveltejs/adapter-static'

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({ fallback: '200.html' }),
        alias: {
            '@/*': '../server/src/*',
        },
    },
}

export default config

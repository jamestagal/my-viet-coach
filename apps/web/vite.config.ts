import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	ssr: {
		// Bundle these CommonJS modules for Cloudflare Workers compatibility
		noExternal: ['ms', 'better-auth', '@better-auth/core', 'zod']
	},
	resolve: {
		// Ensure better-auth uses its bundled Zod version
		dedupe: ['zod']
	}
});

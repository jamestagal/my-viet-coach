import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			// See https://kit.svelte.dev/docs/adapter-cloudflare for options
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		}),
		alias: {
			'@components': 'src/lib/components/ui',
			'@icons': 'node_modules/lucide-svelte/dist/icons',
			'@actions': 'src/lib/actions'
		}
	}
};

export default config;

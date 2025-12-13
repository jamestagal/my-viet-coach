<script>
	import '../app.css';
	import posthog from 'posthog-js';
	import { browser, dev } from '$app/environment';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { getMeta } from '$lib/meta';
	import {
		PUBLIC_DEFAULT_DESCRIPTION,
		PUBLIC_DEFAULT_TITLE,
		PUBLIC_PROJECT_NAME,
		PUBLIC_ORIGIN
	} from '$env/static/public';

	let { children } = $props();

	if (browser && !dev) {
		beforeNavigate(() => posthog.capture('$pageleave'));
		afterNavigate(() => posthog.capture('$pageview'));
	}
	const meta = $derived(
		getMeta({
			defaultTitle: PUBLIC_DEFAULT_TITLE,
			defaultDescription: PUBLIC_DEFAULT_DESCRIPTION,
			defaultOGImage: '/socialcard.jpeg',
			routeMeta: page.data?.meta ?? {},
			url: page.url,
			pageParam: page.params?.page ?? ''
		})
	);

	// JSON-LD Structured Data - Organization schema
	const organizationSchema = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: PUBLIC_PROJECT_NAME,
			url: PUBLIC_ORIGIN,
			logo: `${PUBLIC_ORIGIN}/icon.svg`,
			description: PUBLIC_DEFAULT_DESCRIPTION
		})
	);

	// JSON-LD Structured Data - WebSite schema with search action
	const websiteSchema = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: PUBLIC_PROJECT_NAME,
			url: PUBLIC_ORIGIN,
			description: PUBLIC_DEFAULT_DESCRIPTION
		})
	);

	// JSON-LD Structured Data - WebPage/Article schema (dynamic per page)
	const webPageSchema = $derived(() => {
		const imageUrl = meta.ogImage.startsWith('http') ? meta.ogImage : `${PUBLIC_ORIGIN}${meta.ogImage}`;
		const baseSchema = {
			'@context': 'https://schema.org',
			'@type': meta.ogType === 'article' ? 'Article' : 'WebPage',
			name: meta.title,
			description: meta.description,
			url: meta.canonicalUrl,
			image: imageUrl,
			isPartOf: {
				'@type': 'WebSite',
				name: PUBLIC_PROJECT_NAME,
				url: PUBLIC_ORIGIN
			}
		};

		// Add article-specific fields if ogType is article
		if (meta.ogType === 'article' && page.data?.meta?.publishedTime) {
			return JSON.stringify({
				...baseSchema,
				datePublished: page.data.meta.publishedTime,
				dateModified: page.data.meta.modifiedTime || page.data.meta.publishedTime,
				author: {
					'@type': 'Organization',
					name: PUBLIC_PROJECT_NAME
				}
			});
		}

		return JSON.stringify(baseSchema);
	});
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width" />
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />
	<link rel="canonical" href={meta.canonicalUrl} />

	<!--
		  Icons
		  - https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
			(Usually kept up to date.)
		  - `.ico` is fallback for RSS readers & browsers that don't support SVG:
			 https://caniuse.com/link-icon-svg
	  - `manifest.webmanifest` includes links to 192x192 & 512x512 PNGs.
	  - `apple-touch-icon` is 180x180, but we can use our 192x192 instead.
	  -->

	<link rel="icon" href="/favicon.ico" sizes="32x32" />
	<link rel="icon" href="/icon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />

	<!--
		Open Graph
		- https://ahrefs.com/blog/open-graph-meta-tags/
	  - https://developers.facebook.com/docs/sharing/webmasters#markup
	  - 1200x630px; `og:height` & `og:width` tags are optional; excluding for minimalism.
	  - For `og:type`, use `article` for blog posts & `website` for the rest (blog index, pages, etc).
		- `og:url` is always the canonical URL.
	  - `og:title` & `og:description` are usually same as page title & meta description, but if those
		  are full of SEO keywords, then the og versions could be different.
	-->

	<meta property="og:type" content={meta.ogType} />
	<meta property="og:title" content={meta.ogTitle} />
	<meta property="og:description" content={meta.ogDescription} />
	<meta property="og:image" content={meta.ogImage} />
	<meta property="og:url" content={meta.ogUrl} />

	<!--
	  Twitter
	  - Twitter uses OG's url, title, description, & image tags.
			https://developer.twitter.com/en/docs/twitter-for-websites/cards/guides/getting-started
	  -->
	<meta name="twitter:card" content="summary_large_image" />

	<!--
	  JSON-LD Structured Data (Schema.org)
	  - Helps search engines understand content structure
	  - Organization: Brand/company info
	  - WebSite: Site-level info
	  - WebPage/Article: Page-specific info (dynamic)
	  -->
	{@html `<script type="application/ld+json">${organizationSchema}</script>`}
	{@html `<script type="application/ld+json">${websiteSchema}</script>`}
	{@html `<script type="application/ld+json">${webPageSchema()}</script>`}
</svelte:head>

{@render children()}

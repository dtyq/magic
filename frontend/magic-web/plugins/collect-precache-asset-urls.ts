/**
 * Build-time precache URL collection for vite-plugin-app-service-worker.
 *
 * Dependency direction: plugins → src/workers/service-worker/sw-constants.ts (not dist/sw.js).
 * Path rules must live in source so build-time collection and runtime matchers stay identical.
 */

import {
	HASHED_ASSET_PATTERN,
	isPrecacheableStaticAssetPath,
} from "../src/workers/service-worker/sw-constants"

export { HASHED_ASSET_PATTERN, isPrecacheableStaticAssetPath }

/**
 * Maps dist asset filenames to public URL paths and filters by the shared precache pattern.
 */
export function collectPrecacheAssetUrlsFromAssetFilenames(filenames: string[]): string[] {
	const urls = filenames
		.filter((filename) => /\.(js|css)$/i.test(filename))
		.map((filename) => {
			const normalized = filename.replace(/^assets\//, "")
			return `/assets/${normalized}`
		})
		.filter((url) => isPrecacheableStaticAssetPath(url))

	return Array.from(new Set(urls)).sort()
}

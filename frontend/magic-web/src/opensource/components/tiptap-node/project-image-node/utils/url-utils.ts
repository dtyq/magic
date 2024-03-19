/**
 * Check if URL is directly accessible (http/https)
 */
export function isDirectUrl(url: string): boolean {
	try {
		const urlObj = new URL(url)
		return urlObj.protocol === "http:" || urlObj.protocol === "https:"
	} catch {
		return false
	}
}

/**
 * Check if URL is an absolute URL that should not be prefixed with ./
 * Includes data URLs (base64), http, and https
 */
export function isAbsoluteUrl(url: string): boolean {
	return url.startsWith("data:") || isDirectUrl(url)
}

/**
 * Normalize relative path by adding ./ prefix if needed
 * Returns the path as-is for absolute URLs (data:, http://, https://)
 * Returns the path as-is if it already starts with ./ or ../
 * Otherwise adds ./ prefix
 */
export function normalizeImagePath(path: string): string {
	// Don't modify absolute URLs
	if (isAbsoluteUrl(path)) {
		return path
	}

	// Don't modify paths that already have ./ or ../ prefix
	if (path.startsWith("./") || path.startsWith("../")) {
		return path
	}

	// Add ./ prefix to relative paths
	return `./${path}`
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
	attempt: number,
	initialDelay: number,
	maxDelay: number,
): number {
	return Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
}

const SAFE_PREVIEW_PROTOCOLS = new Set(["https:", "http:"])

export function resolveSafePreviewUrl(url: string): string | null {
	try {
		const baseUrl =
			typeof window !== "undefined" && window.location?.origin
				? window.location.origin
				: undefined
		const parsedUrl = new URL(url, baseUrl)

		if (!SAFE_PREVIEW_PROTOCOLS.has(parsedUrl.protocol)) {
			return null
		}

		return parsedUrl.href
	} catch {
		return null
	}
}

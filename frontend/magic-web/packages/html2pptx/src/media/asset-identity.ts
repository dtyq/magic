/**
 * Stable business identity for media that has been rewritten to a temporary
 * download URL before the HTML reaches the exporter.
 *
 * A signed URL is a transport locator, not an asset identity: its query
 * string (and sometimes its host) can change between pages.  The HTML
 * processing pipeline preserves the original attachment path in
 * `data-original-path`; when that marker exists we use it as the explicit
 * identity and keep the current URL only as the byte source.
 */
export type MediaAssetKind = "image" | "video" | "audio" | "cover"

/**
 * Build a presentation-scoped media key from an original business path.
 *
 * The path is intentionally not lower-cased, URL-decoded, or query-stripped:
 * all of those transformations can alias two distinct case-sensitive or
 * versioned resources.  Only whitespace and path separators are normalized.
 */
export function createMediaAssetKey(
	kind: MediaAssetKind,
	originalPath: string | null | undefined,
): string | undefined {
	const normalizedPath = normalizeMediaAssetPath(originalPath)
	if (!normalizedPath) return undefined
	return `asset:${kind}:${normalizedPath}`
}

/** Read the original resource marker written by the HTML processing pipeline. */
export function getOriginalMediaPath(element: Element): string | undefined {
	for (const attribute of ["data-original-path", "data-original-src", "data-original-href"]) {
		const value = element.getAttribute(attribute)
		const normalized = normalizeMediaAssetPath(value)
		if (normalized) return normalized
	}
	return undefined
}

/** Read a poster-specific marker without ever using it as the video identity. */
export function getOriginalMediaCoverPath(element: Element): string | undefined {
	return normalizeMediaAssetPath(element.getAttribute("data-original-poster-path"))
}

/**
 * Normalize only syntax that cannot change resource identity.  In particular,
 * query strings and fragments are preserved because they may select a
 * version, crop, or SVG fragment rather than merely carrying a signature.
 */
export function normalizeMediaAssetPath(value: string | null | undefined): string | undefined {
	if (typeof value !== "string") return undefined
	const normalized = value.trim().replace(/\\/g, "/")
	if (!normalized) return undefined
	return normalized.replace(/^\.\//, "")
}

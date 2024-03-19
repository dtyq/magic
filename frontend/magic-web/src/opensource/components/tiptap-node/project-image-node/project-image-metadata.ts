import { normalizeImagePath } from "./utils/url-utils"

export interface ProjectImageMetadata {
	width: number | null
	height: number | null
}

/**
 * @deprecated This function has a bug that creates invalid paths like ./../
 * Use proper path handling instead (e.g., calculateRelativePath from @/opensource/utils/path)
 * Kept for backward compatibility with tests
 */
export function normalizeProjectImagePath(path: string | null | undefined) {
	if (!path) return null
	return path.replace(/^\.?\/+/, "")
}

/**
 * Build markdown image size syntax
 * Format: "=WxH" or "=Wx" (height auto)
 * Examples: "=300x200", "=300x"
 * Note: Quoted to comply with markdown title attribute syntax
 */
export function buildProjectImageTitle({ width, height }: Partial<ProjectImageMetadata>): string {
	if (!width) return ""

	// Format: "=WxH" or "=Wx" (height omitted means auto)
	// Wrapped in quotes to be parsed as markdown title attribute
	const heightPart = height ? height.toString() : ""
	return ` "=${width}x${heightPart}"`
}

/**
 * Parse markdown image size syntax
 * Format: =WxH or =Wx (height auto)
 * Examples: =300x200, =300x
 */
export function parseProjectImageTitle(title: string | null | undefined): ProjectImageMetadata {
	const metadata: ProjectImageMetadata = {
		width: null,
		height: null,
	}

	if (!title) {
		return metadata
	}

	// Match format: =300x200 or =300x
	const sizeMatch = title.match(/=(\d+)x(\d*)/)

	if (sizeMatch) {
		metadata.width = parseInt(sizeMatch[1], 10)
		// If height part exists and is not empty, parse it
		if (sizeMatch[2]) {
			metadata.height = parseInt(sizeMatch[2], 10)
		}
	}

	return metadata
}

/**
 * Convert file path to markdown image source
 * Handles both relative paths and absolute HTTP/HTTPS URLs
 * Ensures relative paths are properly formatted without creating invalid patterns like ./../
 */
export function toMarkdownImageSource(filePath: string | null | undefined): string {
	if (!filePath) {
		return ""
	}

	// Remove leading slash if present (e.g., "/images/test.png" -> "images/test.png")
	const withoutLeadingSlash = filePath.startsWith("/") ? filePath.slice(1) : filePath

	// Normalize path (handles data URLs, http/https, and relative paths)
	return normalizeImagePath(withoutLeadingSlash)
}
